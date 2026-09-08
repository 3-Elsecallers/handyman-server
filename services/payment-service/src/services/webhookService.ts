import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import { capturePayment, markPayoutProcessed } from "./paymentService";

interface PaystackWebhookPayload {
  event: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    domain?: string;
    transfersession?: Record<string, unknown>;
    transfer?: {
      reference?: string;
      status?: string;
      amount?: number;
      transfer_code?: string;
    };
  };
}

/**
 * Entry point for verified Paystack webhooks. Persists every processed event
 * (WebhookEvent) so that retries are idempotent — the unique constraint on
 * (event, reference) prevents double-processing.
 */
export const processWebhook = async (input: { event: string; rawPayload: unknown }) => {
  const payload = input.rawPayload as PaystackWebhookPayload;

  const ref =
    payload?.data?.reference ||
    payload?.data?.transfer?.reference ||
    `unknown_${payload?.event || "event"}`;

  let eventId: string | null = null;
  try {
    const recorded = await prisma.webhookEvent.create({
      data: {
        event: payload?.event || input.event,
        reference: ref,
        payload: input.rawPayload as object,
      },
    });
    eventId = recorded.id;
  } catch {
    // Duplicate event (already processed) — no-op, safe to return.
    return;
  }

  try {
    switch (payload?.event) {
      case "charge.success":
        await capturePayment(ref);
        break;

      case "refund.processed":
        await onRefundProcessed(ref);
        break;

      case "transfer.success":
        await onTransferSuccess(payload);
        break;

      case "transfer.failed":
        await onTransferFailed(payload);
        break;

      case "transfer.reversed":
        await onTransferReversed(payload);
        break;

      default:
        // Unknown/irrelevant event — acknowledged, not persisted as processed.
        await prisma.webhookEvent.delete({ where: { id: eventId } });
        return;
    }

    await prisma.webhookEvent.update({
      where: { id: eventId },
      data: { verified: true, processedAt: new Date() },
    });
  } catch (error) {
    if (eventId) {
      await prisma.webhookEvent
        .update({ where: { id: eventId }, data: { verified: false } })
        .catch(() => {});
    }
    throw error;
  }
};

const onRefundProcessed = async (reference: string) => {
  // A refund has settled at Paystack. Update the linked Refund to processed
  // (the payment's status was already moved at refund-request time by
  // paymentService.refundPayment; this just reconciles the Paystack side).
  const refund = await prisma.refund.updateMany({
    where: { paystackRef: reference, status: "pending" },
    data: { status: "processed", processedAt: new Date() },
  });
  if (refund.count === 0) {
    throw new AppError(404, "No pending refund found for reference");
  }
};

const onTransferSuccess = async (payload: PaystackWebhookPayload) => {
  const transfer = payload?.data?.transfer;
  if (!transfer?.reference) throw new AppError(400, "Missing transfer reference");

  // Handle a self-serve PayoutRequest first, then fall back to legacy Payout.
  const payoutRequest = await prisma.payoutRequest.findFirst({
    where: { paystackRef: transfer.reference },
  });
  if (payoutRequest) {
    if (payoutRequest.status !== "processed") {
      await prisma.payoutRequest.update({
        where: { id: payoutRequest.id },
        data: { status: "processed", paidAt: new Date() },
      });
      await publishEvent("payment.payout.completed", payoutRequest.id, {
        providerId: payoutRequest.providerId,
        providerUserId: payoutRequest.providerUserId,
        amount: payoutRequest.netAmount,
        payoutRequestId: payoutRequest.id,
        paystackTransferRef: transfer.reference,
      });
    }
    return;
  }

  const payout = await prisma.payout.findFirst({
    where: { paystackRef: transfer.reference },
  });
  if (!payout) throw new AppError(404, "No payout found for transfer reference");

  if (payout.status === "processed") return;
  await markPayoutProcessed(payout.id, transfer.reference);
};

const onTransferFailed = async (payload: PaystackWebhookPayload) => {
  const transfer = payload?.data?.transfer;
  if (!transfer?.reference) throw new AppError(400, "Missing transfer reference");

  const payoutRequest = await prisma.payoutRequest.findFirst({
    where: { paystackRef: transfer.reference },
  });
  if (!payoutRequest) throw new AppError(404, "No payout request found for transfer reference");
  if (payoutRequest.status === "failed" || payoutRequest.status === "reversed") return;

  // Reverse the reserved wallet debit and mark the request failed.
  await prisma.$transaction(async (tx) => {
    await tx.payoutRequest.update({
      where: { id: payoutRequest.id },
      data: { status: "failed", failedAt: new Date() },
    });
    const wallet = await tx.ledgerAccount.findUnique({
      where: { type_ownerId: { type: "provider_wallet", ownerId: payoutRequest.providerId } },
    });
    if (wallet) {
      await tx.ledgerEntry.create({
        data: {
          accountId: wallet.id,
          counterpartyId: null,
          type: "refund",
          credit: payoutRequest.amount,
          debit: 0,
          currency: "GHS",
          refType: "PayoutRequestReversal",
          refId: payoutRequest.id,
        },
      });
    }
  });
};

const onTransferReversed = async (payload: PaystackWebhookPayload) => {
  const transfer = payload?.data?.transfer;
  if (!transfer?.reference) throw new AppError(400, "Missing transfer reference");

  const payoutRequest = await prisma.payoutRequest.findFirst({
    where: { paystackRef: transfer.reference },
  });
  if (!payoutRequest) throw new AppError(404, "No payout request found for transfer reference");

  await prisma.$transaction(async (tx) => {
    await tx.payoutRequest.update({
      where: { id: payoutRequest.id },
      data: { status: "reversed", reversedAt: new Date() },
    });
    const wallet = await tx.ledgerAccount.findUnique({
      where: { type_ownerId: { type: "provider_wallet", ownerId: payoutRequest.providerId } },
    });
    if (wallet) {
      await tx.ledgerEntry.create({
        data: {
          accountId: wallet.id,
          counterpartyId: null,
          type: "refund",
          credit: payoutRequest.amount,
          debit: 0,
          currency: "GHS",
          refType: "PayoutRequestReversal",
          refId: payoutRequest.id,
        },
      });
    }
  });
};
