import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { capturePayment, markPayoutProcessed } from "./paymentService";

interface PaystackWebhookPayload {
  event: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    domain?: string;
    transfer?: {
      reference?: string;
      status?: string;
      amount?: number;
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

  const payout = await prisma.payout.findFirst({
    where: { paystackRef: transfer.reference },
  });
  if (!payout) throw new AppError(404, "No payout found for transfer reference");

  if (payout.status === "processed") return;
  await markPayoutProcessed(payout.id, transfer.reference);
};
