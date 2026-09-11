import { prisma } from "../db/prisma";
import { Prisma } from "../../generated/prisma";
import { config } from "../config/env";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import { fetchBooking, fetchUser } from "../utils/serviceClient";
import * as paystack from "../utils/paystack";
import { encryptString } from "../utils/encryption";
import {
  postOnlineAllocation,
  postCashFee,
  postTip,
  postRefundReversal,
  providerBalance,
  accountBalance,
  resolveAccount,
  ACCOUNT_PLATFORM_FEE,
  ACCOUNT_RESERVE,
} from "./ledgerService";

/**
 * Payment service business logic. All Paystack-specific calls are isolated in
 * ../utils/paystack. Platform fee model:
 *   platformFee     = pct% x amount + flat
 *   providerEarning = amount - platformFee
 * Tips are charged 100% to the provider (no platform fee).
 */

type PaymentStatus = "pending" | "authorized" | "paid" | "refunded" | "partially_refunded" | "failed";
type PaymentType = "booking" | "tip";
type PaymentMethod = "online" | "cash";

export interface PaymentWithRelations {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string | null;
  providerUserId: string | null;
  type: PaymentType;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  amount: number;
  platformFee: number;
  providerEarning: number;
  tipAmount: number;
  paystackRef: string | null;
  paystackAccessCode: string | null;
  authorizationUrl: string | null;
  refundedAmount: number;
  refundReason: string | null;
  initiatedAt: Date;
  capturedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  refunds: Array<{ id: string; amount: number; reason: string | null; status: string; createdAt: Date }>;
}

const paymentSelect = {
  refunds: { orderBy: { createdAt: "desc" } as const },
};

const normalizePayment = (p: {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string | null;
  providerUserId: string | null;
  type: string;
  status: string;
  paymentMethod?: string | null;
  amount: number;
  platformFee: number;
  providerEarning: number;
  tipAmount: number;
  paystackRef: string | null;
  paystackAccessCode: string | null;
  authorizationUrl: string | null;
  refundedAmount: number;
  refundReason: string | null;
  initiatedAt: Date;
  capturedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  refunds?: Array<{ id: string; amount: number; reason: string | null; status: string; createdAt: Date }>;
}): PaymentWithRelations => ({
  id: p.id,
  bookingId: p.bookingId,
  customerId: p.customerId,
  providerId: p.providerId,
  providerUserId: p.providerUserId,
  type: p.type as PaymentType,
  status: p.status as PaymentStatus,
  paymentMethod: (p.paymentMethod as PaymentMethod) ?? "online",
  amount: p.amount,
  platformFee: p.platformFee,
  providerEarning: p.providerEarning,
  tipAmount: p.tipAmount,
  paystackRef: p.paystackRef,
  paystackAccessCode: p.paystackAccessCode,
  authorizationUrl: p.authorizationUrl,
  refundedAmount: p.refundedAmount,
  refundReason: p.refundReason,
  initiatedAt: p.initiatedAt,
  capturedAt: p.capturedAt,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  refunds: p.refunds ?? [],
});

const computeFees = (amount: number, isTip: boolean) => {
  if (isTip) return { platformFee: 0, providerEarning: amount };
  const platformFee = Math.round(
    (amount * config.paystack.platformFeePct) / 100 +
      config.paystack.platformFeeFlat,
  );
  return { platformFee, providerEarning: amount - platformFee };
};

const emailFor = async (customerId: string): Promise<string> => {
  const user = await fetchUser(customerId);
  return user?.email || `customer+${customerId}@handyman.app`;
};

/**
 * Records/returns a Payment row for a booking. Callers may want to create the
 * record without hitting Paystack (e.g. non-configured dev) — Paystack is
 * called only during initializeForBooking, not here.
 */
export const getByBooking = async (bookingId: string, type: PaymentType = "booking") => {
  return prisma.payment.findFirst({
    where: { bookingId, type },
    include: paymentSelect,
  });
};

export const getById = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: paymentSelect,
  });
  if (!payment) throw new AppError(404, "Payment not found");
  return normalizePayment(payment);
};

/**
 * Initializes a payment for the given booking: computes the charge, records a
 * `pending` Payment row, and (when configured) opens a Paystack transaction.
 * Idempotent — an existing pending/paid booking payment is returned as-is.
 */
export const initializeForBooking = async (
  bookingId: string,
  initiatedBy?: { id?: string; role?: string; source?: string },
  paymentMethodInput?: "online" | "cash",
) => {
  const booking = await fetchBooking(bookingId);
  // Payments may only be opened after the provider marks the service complete.
  if (booking.status !== "completed") {
    throw new AppError(409, "Payment can only be initialized after the service is completed");
  }
  const existing = await getByBooking(bookingId, "booking");
  if (existing) {
    return normalizePayment(existing);
  }

  const paymentMethod: PaymentMethod = paymentMethodInput || "online";
  const amount = booking.priceQuote;
  const { platformFee, providerEarning } = computeFees(amount, false);

  let paystackRef: string | null = null;
  let accessCode: string | null = null;
  let authorizationUrl: string | null = null;

  // Cash payments never open a Paystack charge — the provider confirms the cash
  // in person and the platform fee is settled from the provider wallet.
  if (paymentMethod === "online") {
    const localRef = `local_${bookingId}`;
    if (config.paystack.secretKey) {
      const email = await emailFor(booking.customerId);
      const init = await paystack.initializeTransaction({
        email,
        amount,
        reference: localRef,
        metadata: { bookingId, customerId: booking.customerId },
        callback_url: `${config.clientUrl}/customer/dashboard/bookings/${booking.id}`
      });
      paystackRef = init.reference;
      accessCode = init.access_code;
      authorizationUrl = init.authorization_url;
    } else {
      paystackRef = localRef;
    }
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      customerId: booking.customerId,
      providerId: booking.providerId,
      providerUserId: booking.providerUserId,
      type: "booking",
      status: "pending",
      paymentMethod,
      amount,
      platformFee,
      providerEarning,
      tipAmount: 0,
      paystackRef,
      paystackAccessCode: accessCode,
      authorizationUrl,
      initiatedById: initiatedBy?.id,
      initiatedByRole: initiatedBy?.role,
      initiatedBy: initiatedBy?.source,
    },
    include: paymentSelect,
  });

  return normalizePayment(payment);
};

/**
 * Verifies a payment against Paystack by its reference. Only transitions
 * pending/authorized payments; already-paid payments are returned unchanged
 * (idempotent). Publishes `payment.captured` on success.
 */
export const verifyPayment = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: paymentSelect,
  });
  if (!payment) throw new AppError(404, "Payment not found");

  if (payment.status === "paid") return normalizePayment(payment);
  if (!payment.paystackRef) throw new AppError(400, "Payment has no Paystack reference");

  const result = await paystack.verifyTransaction(payment.paystackRef);

  if (result.status === "success") {
    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "paid", capturedAt: new Date(), paystackRef: result.reference },
      include: paymentSelect,
    });
    if (updated.type === "tip") {
      await postTip({ paymentId: updated.id, providerId: updated.providerId, amount: updated.tipAmount });
    } else {
      await postOnlineAllocation({
        paymentId: updated.id,
        providerId: updated.providerId,
        providerEarning: updated.providerEarning,
        platformFee: updated.platformFee,
      });
    }
    await publishEvent("payment.captured", updated.id, {
      paymentId: updated.id,
      bookingId: updated.bookingId,
      customerId: updated.customerId,
      providerId: updated.providerId,
      providerUserId: updated.providerUserId,
      userId: updated.customerId,
      amount: updated.amount,
      platformFee: updated.platformFee,
      providerEarning: updated.providerEarning,
    });
    return normalizePayment(updated);
  }

  const failed = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "failed", failedAt: new Date() },
    include: paymentSelect,
  });
  return normalizePayment(failed);
};

/** Marks a payment as failed (used when a customer abandons checkout). */
export const markFailed = async (paymentId: string) => {
  const payment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "failed", failedAt: new Date() },
    include: paymentSelect,
  });
  return normalizePayment(payment);
};

/** Captures a payment whose Paystack charge succeeded (webhook path). */
export const capturePayment = async (reference: string) => {
  const payment = await prisma.payment.findUnique({
    where: { paystackRef: reference },
    include: paymentSelect,
  });
  if (!payment) throw new AppError(404, "Payment not found for reference");

  // Idempotent webhook: if already captured, no-op.
  if (payment.status === "paid") return normalizePayment(payment);

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "paid", capturedAt: new Date() },
    include: paymentSelect,
  });
  if (updated.type === "tip") {
    await postTip({ paymentId: updated.id, providerId: updated.providerId, amount: updated.tipAmount });
  } else {
    await postOnlineAllocation({
      paymentId: updated.id,
      providerId: updated.providerId,
      providerEarning: updated.providerEarning,
      platformFee: updated.platformFee,
    });
  }
  await publishEvent("payment.captured", updated.id, {
    paymentId: updated.id,
    bookingId: updated.bookingId,
    customerId: updated.customerId,
    providerId: updated.providerId,
    providerUserId: updated.providerUserId,
    userId: updated.customerId,
    amount: updated.amount,
    platformFee: updated.platformFee,
    providerEarning: updated.providerEarning,
  });
  return normalizePayment(updated);
};

/**
 * Provider confirms a cash payment was received in person. Flips pending ->
 * paid (no Paystack charge) and posts the `cash_fee` ledger movement.
 */
export const confirmCashPaid = async (paymentId: string, providerUserId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: paymentSelect,
  });
  if (!payment) throw new AppError(404, "Payment not found");
  if (payment.paymentMethod !== "cash") {
    throw new AppError(409, "Not a cash payment");
  }
  if (payment.providerUserId !== providerUserId) {
    throw new AppError(403, "Only the booking provider can confirm cash");
  }
  if (payment.status === "paid") return normalizePayment(payment);

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "paid",
      paymentMethod: "cash",
      providerConfirmedAt: new Date(),
      providerConfirmedById: providerUserId,
      cashCollectedAt: new Date(),
    },
    include: paymentSelect,
  });
  await postCashFee({
    paymentId: updated.id,
    providerId: updated.providerId,
    platformFee: updated.platformFee,
  });
  await publishEvent("payment.paid.cash", updated.id, {
    paymentId: updated.id,
    bookingId: updated.bookingId,
    customerId: updated.customerId,
    providerId: updated.providerId,
    amount: updated.amount,
    platformFee: updated.platformFee,
  });
  await publishEvent("payment.confirmed", updated.id, {
    bookingId: updated.bookingId,
    paymentMethod: "cash",
    paymentStatus: "cash_collected",
    confirmedById: providerUserId,
  });
  return normalizePayment(updated);
};

/**
 * Provider-driven confirmation echo for online payments (already paid). Marks
 * the payment provider-confirmed and posts any pending ledger allocation in a
 * single transaction.
 */
export const confirmOnline = async (paymentId: string, providerUserId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: paymentSelect,
  });
  if (!payment) throw new AppError(404, "Payment not found");
  if (payment.paymentMethod !== "online") throw new AppError(409, "Not an online payment");
  if (payment.providerUserId !== providerUserId) {
    throw new AppError(403, "Only the booking provider can confirm payment");
  }
  if (payment.status !== "paid") {
    throw new AppError(409, "Payment must be captured before it can be confirmed");
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      providerConfirmedAt: new Date(),
      providerConfirmedById: providerUserId,
    },
    include: paymentSelect,
  });
  await publishEvent("payment.confirmed", updated.id, {
    bookingId: updated.bookingId,
    paymentMethod: "online",
    paymentStatus: "confirmed",
    confirmedById: providerUserId,
  });
  return normalizePayment(updated);
};

export const refundPayment = async (
  paymentId: string,
  input: { amount?: number; reason?: string; initiator?: { id?: string; role?: string } },
) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: paymentSelect,
  });
  if (!payment) throw new AppError(404, "Payment not found");
  if (payment.status !== "paid") {
    throw new AppError(400, "Only paid payments can be refunded");
  }

  const netAmount = payment.amount - payment.tipAmount;
  const remaining = netAmount - payment.refundedAmount;
  const amount = input.amount != null ? input.amount : remaining;
  if (amount <= 0) throw new AppError(400, "Refund amount must be positive");
  if (amount > remaining + 1e-9) {
    throw new AppError(400, "Refund amount exceeds remaining refundable amount");
  }

  if (!payment.paystackRef) throw new AppError(400, "Payment has no Paystack reference");

  const refund = await prisma.refund.create({
    data: {
      paymentId: payment.id,
      amount,
      reason: input.reason,
      initiatorId: input.initiator?.id,
      initiatorRole: input.initiator?.role,
      paystackRef: payment.paystackRef,
      status: "pending",
    },
  });

  try {
    await paystack.refundTransaction({ reference: payment.paystackRef, amount });
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: "processed", processedAt: new Date() },
    });
  } catch (err) {
    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: "failed", failedAt: new Date() },
    });
    throw err;
  }

  // For online bookings, reverse the captured allocation back to `collected`.
  if (payment.type === "booking" && payment.paymentMethod === "online") {
    await postRefundReversal({
      refundId: refund.id,
      providerId: payment.providerId,
      providerEarning: payment.providerEarning,
      platformFee: payment.platformFee,
      hold: Math.round(payment.providerEarning * 0.1 * 100) / 100,
    });
  }

  const newRefunded = Math.round((payment.refundedAmount + amount) * 100) / 100;
  const nextStatus: PaymentStatus =
    newRefunded >= netAmount - 1e-9 ? "refunded" : "partially_refunded";

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: nextStatus,
      refundedAmount: newRefunded,
      refundReason: input.reason || payment.refundReason,
    },
    include: paymentSelect,
  });

  await publishEvent("payment.refunded", updated.id, {
    paymentId: updated.id,
    bookingId: updated.bookingId,
    refundAmount: amount,
    reason: input.reason,
  });

  return normalizePayment(updated);
};

export const addTip = async (
  paymentId: string,
  input: { amount: number; initiatorId: string },
) => {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new AppError(404, "Payment not found");

  const maxTip = Math.round(payment.amount * 0.5 * 100) / 100;
  if (input.amount <= 0 || input.amount > maxTip) {
    throw new AppError(400, `Tip must be greater than 0 and at most 50% of the service amount (${maxTip})`);
  }

  const existingTip = await getByBooking(payment.bookingId, "tip");
  if (existingTip) throw new AppError(409, "A tip has already been added for this booking");

  const { platformFee, providerEarning } = computeFees(input.amount, true);

  let paystackRef: string | null = null;
  let authorizationUrl: string | null = null;
  const localRef = `tip_${payment.bookingId}`;
  if (config.paystack.secretKey) {
    const email = await emailFor(payment.customerId);
    const init = await paystack.initializeTransaction({
      email,
      amount: input.amount,
      reference: localRef,
      metadata: { bookingId: payment.bookingId, type: "tip" },
    });
    paystackRef = init.reference;
    authorizationUrl = init.authorization_url;
  } else {
    paystackRef = localRef;
  }

  const tip = await prisma.payment.create({
    data: {
      bookingId: payment.bookingId,
      customerId: payment.customerId,
      providerId: payment.providerId,
      providerUserId: payment.providerUserId,
      type: "tip",
      status: "pending",
      amount: input.amount,
      platformFee,
      providerEarning,
      tipAmount: input.amount,
      paystackRef,
      authorizationUrl,
      initiatedById: input.initiatorId,
      initiatedByRole: "customer",
      initiatedBy: "customer.tip",
    },
    include: paymentSelect,
  });

  return normalizePayment(tip);
};

/**
 * Creates a payout record for a captured booking payment's provider earnings.
 * Actual Paystack transfer issuance is gated on a configured provider recipient
 * (subaccount provisioning is outside the current system); payout records and
 * the `transfer.success` webhook make the flow auditable and extensible.
 */
export const recordPayout = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { payouts: true },
  });
  if (!payment) throw new AppError(404, "Payment not found");
  if (payment.status !== "paid") {
    throw new AppError(400, "Only paid payments are eligible for payout");
  }
  if (!payment.providerId) throw new AppError(400, "Payment has no provider");

  const existing = payment.payouts.find((p) => p.status === "pending");
  if (existing) return existing;

  const payout = await prisma.payout.create({
    data: {
      paymentId: payment.id,
      providerId: payment.providerId,
      amount: payment.providerEarning,
      status: "pending",
    },
  });
  return payout;
};

export const markPayoutProcessed = async (payoutId: string, transferRef: string) => {
  const payout = await prisma.payout.update({
    where: { id: payoutId },
    data: { status: "processed", paystackRef: transferRef, paidAt: new Date() },
  });
  await publishEvent("payment.payout.completed", payout.id, {
    providerId: payout.providerId,
    amount: payout.amount,
    paystackTransferRef: transferRef,
  });
  return payout;
};

// ----- Queries (customer / provider / admin visibility) -----

export const listCustomerPayments = async (customerId: string, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: paymentSelect,
    }),
    prisma.payment.count({ where: { customerId } }),
  ]);
  return {
    payments: payments.map(normalizePayment),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getProviderEarnings = async (providerUserId: string) => {
  const payments = await prisma.payment.findMany({
    where: { providerUserId, type: "booking" },
  });
  const earned = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.providerEarning, 0);
  const tipTotal = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.tipAmount, 0);
  const pending = payments
    .filter((p) => p.status === "pending" || p.status === "authorized")
    .reduce((sum, p) => sum + p.providerEarning, 0);

  const payoutRecords = await prisma.payout.findMany({
    where: { payment: { providerUserId } },
  });
  const paidOut = payoutRecords
    .filter((p) => p.status === "processed")
    .reduce((sum, p) => sum + p.amount, 0);

  return {
    providerUserId,
    totalEarned: Math.round(earned * 100) / 100,
    totalTips: Math.round(tipTotal * 100) / 100,
    availableBalance: Math.round((earned + tipTotal - paidOut) * 100) / 100,
    pendingBalance: Math.round(pending * 100) / 100,
    paidOut: Math.round(paidOut * 100) / 100,
  };
};

export const listProviderPayouts = async (providerId: string, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where: { providerId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payout.count({ where: { providerId } }),
  ]);
  return { payouts, total, page, limit, totalPages: Math.ceil(total / limit) };
};

// ----- Ledger-backed wallet (single source of truth) -----

/**
 * Provider wallet summary derived from the ledger. `available` is the current
 * provider_wallet balance; `pending` is the 24h hold still in `reserve`; paidOut
 * sums processed PayoutRequest rows. If the wallet is negative (owed cash fees
 * from fee-from-future-earnings), `owed` reports the shortfall.
 */
export const getProviderWallet = async (providerUserId: string) => {
  const firstPayment = await prisma.payment.findFirst({ where: { providerUserId } });
  const providerId = firstPayment?.providerId ?? null;

  let available = 0;
  if (providerId) {
    await resolveAccount("provider_wallet", providerId);
    available = await providerBalance(providerId);
  }

  const held = await prisma.ledgerEntry.aggregate({
    where: { accountId: ACCOUNT_RESERVE },
    _sum: { credit: true },
  });

  const [processedPayouts, pendingRequests] = await Promise.all([
    prisma.payoutRequest.aggregate({
      where: { providerUserId, status: "processed" },
      _sum: { netAmount: true },
    }),
    prisma.payoutRequest.findMany({
      where: { providerUserId, status: { in: ["pending", "processing"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    providerUserId,
    providerId,
    available: Math.round(available * 100) / 100,
    owed: available < 0 ? Math.round(Math.abs(available) * 100) / 100 : 0,
    pendingHold: Math.round((held._sum.credit ?? 0) * 100) / 100,
    paidOut: Math.round((processedPayouts._sum.netAmount ?? 0) * 100) / 100,
    pendingWithdrawals: pendingRequests.map((p) => ({
      id: p.id,
      amount: p.amount,
      fee: p.fee,
      netAmount: p.netAmount,
      status: p.status,
      createdAt: p.createdAt,
    })),
    currency: "GHS",
  };
};

// ----- Payout methods & withdrawals -----

export const getPayoutMethod = async (providerId: string) => {
  return prisma.payoutMethod.findUnique({ where: { providerId } });
};

export const savePayoutMethod = async (input: {
  providerId: string;
  providerUserId: string;
  medium: "mobile_money" | "bank";
  network?: string;
  accountName: string;
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
  recipientCode?: string;
}) => {
  const encrypted = encryptString(input.accountNumber);
  return prisma.payoutMethod.upsert({
    where: { providerId: input.providerId },
    create: {
      providerId: input.providerId,
      providerUserId: input.providerUserId,
      medium: input.medium,
      network: input.network ?? null,
      accountName: input.accountName,
      accountNumberEncrypted: encrypted,
      bankCode: input.bankCode ?? null,
      bankName: input.bankName ?? null,
      recipientCode: input.recipientCode ?? null,
      isActive: true,
    },
    update: {
      medium: input.medium,
      network: input.network ?? null,
      accountName: input.accountName,
      accountNumberEncrypted: encrypted,
      bankCode: input.bankCode ?? null,
      bankName: input.bankName ?? null,
      recipientCode: input.recipientCode ?? null,
      isActive: true,
    },
  });
};

export const updatePayoutMethod = async (providerId: string, input: Partial<{
  medium: "mobile_money" | "bank";
  network?: string;
  accountName: string;
  accountNumber: string;
  bankCode?: string;
  bankName?: string;
  recipientCode?: string;
  isActive?: boolean;
}>) => {
  const data: Record<string, unknown> = {};
  if (input.medium) data.medium = input.medium;
  if (input.network != null) data.network = input.network;
  if (input.accountName != null) data.accountName = input.accountName;
  if (input.accountNumber != null) {
    data.accountNumberEncrypted = encryptString(input.accountNumber);
  }
  if (input.bankCode != null) data.bankCode = input.bankCode;
  if (input.bankName != null) data.bankName = input.bankName;
  if (input.recipientCode != null) data.recipientCode = input.recipientCode;
  if (input.isActive != null) data.isActive = input.isActive;
  return prisma.payoutMethod.update({ where: { providerId }, data });
};

export const deletePayoutMethod = async (providerId: string, providerUserId: string) => {
  const pending = await prisma.payoutRequest.count({
    where: { providerUserId, status: { in: ["pending", "processing"] } },
  });
  if (pending > 0) {
    throw new AppError(409, "Cannot delete a payout method with pending withdrawals");
  }
  return prisma.payoutMethod.delete({ where: { providerId } });
};

/**
 * Self-serve withdrawal. Validates balance + minimum, atomically reserves the
 * amount (SELECT...FOR UPDATE on the provider wallet via PayoutRequest creation
 * and a matching payout debit), then issues a Paystack transfer.
 */
export const withdrawForProvider = async (input: {
  providerId: string;
  providerUserId: string;
  amount: number;
  initiatedById?: string;
}) => {
  const { amount, providerId, providerUserId } = input;
  if (amount <= 0) throw new AppError(400, "Withdrawal amount must be positive");
  if (amount < config.payouts.minAmount) {
    throw new AppError(400, `Minimum withdrawal is ${config.payouts.minAmount} GHS`);
  }

  const method = await prisma.payoutMethod.findUnique({ where: { providerId } });
  if (!method || !method.isActive) {
    throw new AppError(400, "No active payout method on file");
  }
  if (!method.recipientCode) throw new AppError(400, "Payout method has no recipient code");

  const fee = await paystack.getTransferFee(amount);
  const netAmount = Math.round((amount - fee) * 100) / 100;
  if (netAmount <= 0) throw new AppError(400, "Amount is too small to cover the transfer fee");

  const balance = await providerBalance(providerId);
  if (balance < amount) {
    throw new AppError(400, `Insufficient balance (available ${balance} GHS)`);
  }

  // Atomic reservation: create PayoutRequest + matching provider_wallet debit.
  let walletId = "";
  const created = await prisma.$transaction(async (tx) => {
    walletId = await resolveAccountTx(tx, providerId);
    const req = await tx.payoutRequest.create({
      data: {
        providerId,
        providerUserId,
        medium: method.medium,
        amount,
        fee,
        netAmount,
        status: "pending",
        recipientCode: method.recipientCode,
        initiatedById: input.initiatedById ?? null,
      },
    });
    await tx.ledgerEntry.create({
      data: {
        accountId: walletId,
        counterpartyId: null,
        type: "payout",
        debit: amount,
        credit: 0,
        currency: "GHS",
        refType: "PayoutRequest",
        refId: req.id,
      },
    });
    return req;
  });

  // Issue the Paystack transfer (best-effort; on failure the debit stays as a
  // reservation and the webhook/reconciliation reverses it).
  const reference = `wdr_${created.id}`;
  try {
    const transfer = await paystack.createTransfer({
      amount: netAmount,
      recipient: created.recipientCode!,
      reason: "Provider withdrawal",
      source: "balance",
      reference,
    });
    const transferCode = (transfer as { transfer_code?: string }).transfer_code;
    await prisma.payoutRequest.update({
      where: { id: created.id },
      data: { status: "processing", paystackRef: reference, transferCode: transferCode ?? null },
    });
  } catch (error) {
    await prisma.payoutRequest.update({
      where: { id: created.id },
      data: { status: "failed", failedAt: new Date() },
    });
    throw error;
  }

  return {
    id: created.id,
    amount,
    fee,
    netAmount,
    status: "processing",
    walletId,
  };
};

const resolveAccountTx = async (tx: Prisma.TransactionClient, providerId: string) => {
  const acc = await resolveAccount("provider_wallet", providerId, tx);
  return acc.id;
};

export const listProviderWithdrawals = async (providerUserId: string, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where: { providerUserId },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payoutRequest.count({ where: { providerUserId } }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getCompanyWallet = async () => {
  await resolveAccount("platform_fee", null);
  const balance = await accountBalance(ACCOUNT_PLATFORM_FEE);
  return { balance: Math.round(balance * 100) / 100, currency: "GHS" };
};

export const listLedger = async (filter: { accountId?: string; refType?: string; providerId?: string; page?: number; limit?: number }) => {
  const page = filter.page || 1;
  const limit = Math.min(filter.limit || 50, 200);
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (filter.accountId) where.accountId = filter.accountId;
  if (filter.refType) where.refType = filter.refType;
  if (filter.providerId) {
    where.OR = [{ accountId: `provider_wallet:${filter.providerId}` }, { counterpartyId: `provider_wallet:${filter.providerId}` }];
  }
  const [items, total] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.ledgerEntry.count({ where }),
  ]);
  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const listAccounts = async () => {
  return prisma.ledgerAccount.findMany({ orderBy: { createdAt: "asc" } });
};

// Re-export company/global balance helpers
export { accountBalance as companyBalance };
export { providerBalance as providerBalanceFor };

export interface AdminFilter {
  search?: string;
  bookingId?: string;
  customerId?: string;
  providerId?: string;
  status?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export const listAdminPayments = async (filter: AdminFilter) => {
  const page = filter.page || 1;
  const limit = Math.min(filter.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (filter.bookingId) where.bookingId = filter.bookingId;
  if (filter.customerId) where.customerId = filter.customerId;
  if (filter.providerId) where.providerId = filter.providerId;
  if (filter.status) where.status = filter.status;
  if (filter.type) where.type = filter.type;
  if (filter.search) {
    where.OR = [
      { paystackRef: { contains: filter.search, mode: "insensitive" } },
      { bookingId: { contains: filter.search, mode: "insensitive" } },
    ];
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: paymentSelect,
    }),
    prisma.payment.count({ where }),
  ]);

  return {
    payments: payments.map(normalizePayment),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};
