import { prisma } from "../db/prisma";
import { config } from "../config/env";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import { fetchBooking, fetchUser } from "../utils/serviceClient";
import * as paystack from "../utils/paystack";

/**
 * Payment service business logic. All Paystack-specific calls are isolated in
 * ../utils/paystack. Platform fee model:
 *   platformFee     = pct% x amount + flat
 *   providerEarning = amount - platformFee
 * Tips are charged 100% to the provider (no platform fee).
 */

type PaymentStatus = "pending" | "authorized" | "paid" | "refunded" | "partially_refunded" | "failed";
type PaymentType = "booking" | "tip";

export interface PaymentWithRelations {
  id: string;
  bookingId: string;
  customerId: string;
  providerId: string | null;
  providerUserId: string | null;
  type: PaymentType;
  status: PaymentStatus;
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
) => {
  const booking = await fetchBooking(bookingId);
  const existing = await getByBooking(bookingId, "booking");
  if (existing) {
    return normalizePayment(existing);
  }

  const amount = booking.priceQuote;
  const { platformFee, providerEarning } = computeFees(amount, false);

  let paystackRef: string | null = null;
  let accessCode: string | null = null;
  let authorizationUrl: string | null = null;

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

  const payment = await prisma.payment.create({
    data: {
      bookingId,
      customerId: booking.customerId,
      providerId: booking.providerId,
      providerUserId: booking.providerUserId,
      type: "booking",
      status: "pending",
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
