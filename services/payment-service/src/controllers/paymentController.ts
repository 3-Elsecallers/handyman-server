import { Request, Response } from "express";
import { prisma } from "../db/prisma";
import { PayoutStatus } from "../../generated/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import * as paymentService from "../services/paymentService";
import { processWebhook } from "../services/webhookService";
import { verifyWebhookSignature, verifyTransaction } from "../utils/paystack";

const isAdmin = (req: Request) => req.user?.role === "admin";

// Express 5 types route/query params as string | string[]; coerce to a single
// string to keep handler code simple.
const param = (req: Request, name: string): string => {
  const v = req.params[name];
  return Array.isArray(v) ? v[0] : v;
};
const q = (req: Request, name: string): string | undefined => {
  const v = req.query[name];
  if (Array.isArray(v)) {
    const first = v[0];
    return typeof first === "string" ? first : undefined;
  }
  return typeof v === "string" ? v : undefined;
};

const verifyOwnership = (req: Request, payment: { customerId: string; providerUserId: string | null }) => {
  if (isAdmin(req)) return;
  if (req.user?.id === payment.customerId) return;
  if (payment.providerUserId && req.user?.id === payment.providerUserId) return;
  throw new AppError(403, "Not authorized to access this payment");
};

// ----- Customer-facing -----

export const initializePayment = async (req: Request, res: Response) => {
  const { bookingId } = req.body as { bookingId?: string };
  if (!bookingId) throw new AppError(400, "bookingId is required");

  const payment = await paymentService.initializeForBooking(bookingId, {
    id: req.user?.id,
    role: req.user?.role,
    source: "customer.initialize",
  });
  return res.status(201).json({ success: true, data: payment });
};

export const getPayment = async (req: Request, res: Response) => {
  const payment = await paymentService.getById(param(req, "id"));
  verifyOwnership(req, payment);
  return res.json({ success: true, data: payment });
};

export const verifyPayment = async (req: Request, res: Response) => {
  const payment = await paymentService.getById(param(req, "id"));
  verifyOwnership(req, payment);
  const result = await paymentService.verifyPayment(payment.id);
  return res.json({ success: true, data: result });
};

export const listCustomerPayments = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const userId = req.user!.id;
  return res.json({ success: true, data: await paymentService.listCustomerPayments(userId, page, limit) });
};

export const addTip = async (req: Request, res: Response) => {
  const { amount } = req.body as { amount?: number };
  if (!amount || amount <= 0) throw new AppError(400, "Valid tip amount is required");
  const payment = await paymentService.addTip(param(req, "id"), {
    amount,
    initiatorId: req.user!.id,
  });
  return res.status(201).json({ success: true, data: payment });
};

export const refundPayment = async (req: Request, res: Response) => {
  const payment = await paymentService.getById(param(req, "id"));
  // Only admins and the paying customer may initiate a refund here.
  if (!isAdmin(req) && req.user?.id !== payment.customerId) {
    throw new AppError(403, "Not authorized to refund this payment");
  }
  const { amount, reason } = req.body as { amount?: number; reason?: string };
  const result = await paymentService.refundPayment(payment.id, {
    amount: amount != null ? Number(amount) : undefined,
    reason,
    initiator: { id: req.user?.id, role: req.user?.role },
  });
  return res.json({ success: true, data: result });
};

// ----- Provider-facing -----

export const providerEarnings = async (req: Request, res: Response) => {
  const providerUserId = req.user!.id;
  return res.json({ success: true, data: await paymentService.getProviderEarnings(providerUserId) });
};

export const providerPayouts = async (req: Request, res: Response) => {
  const payment = await prisma.payment.findFirst({
    where: { providerUserId: req.user!.id },
  });
  if (!payment) return res.json({ success: true, data: { payouts: [], total: 0, page: 1, limit: 20, totalPages: 0 } });
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const providerId = payment.providerId!;
  return res.json({ success: true, data: await paymentService.listProviderPayouts(providerId, page, limit) });
};

// ----- Provider ledger view (payments referencing this provider) -----

export const providerLedger = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const skip = (page - 1) * limit;
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where: { providerUserId: req.user!.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.payment.count({ where: { providerUserId: req.user!.id } }),
  ]);
  return res.json({
    success: true,
    data: { payments, total, page, limit, totalPages: Math.ceil(total / limit) },
  });
};

// ----- Provider wallet & payments -----

export const providerWallet = async (req: Request, res: Response) => {
  const wallet = await paymentService.getProviderWallet(req.user!.id);
  return res.json({ success: true, data: wallet });
};

export const confirmPayment = async (req: Request, res: Response) => {
  const payment = await paymentService.getById(param(req, "id"));
  if (req.user?.id !== payment.providerUserId && !isAdmin(req)) {
    throw new AppError(403, "Not authorized to confirm this payment");
  }
  const paymentMethod = payment.paymentMethod;
  const result =
    paymentMethod === "cash"
      ? await paymentService.confirmCashPaid(payment.id, req.user!.id)
      : await paymentService.confirmOnline(payment.id, req.user!.id);
  return res.json({ success: true, data: result });
};

export const getPayoutMethod = async (req: Request, res: Response) => {
  const method = await paymentService.getPayoutMethod(req.user!.id);
  if (!method) return res.status(404).json({ success: false, message: "No payout method on file" });
  return res.json({ success: true, data: method });
};

export const savePayoutMethod = async (req: Request, res: Response) => {
  const { medium, network, accountName, accountNumber, bankCode, bankName, recipientCode } =
    req.body as {
      medium: "mobile_money" | "bank";
      network?: string;
      accountName: string;
      accountNumber: string;
      bankCode?: string;
      bankName?: string;
      recipientCode?: string;
    };
  if (!medium || !accountName || !accountNumber) {
    throw new AppError(400, "medium, accountName and accountNumber are required");
  }
  const result = await paymentService.savePayoutMethod({
    providerId: req.user!.id,
    providerUserId: req.user!.id,
    medium,
    network,
    accountName,
    accountNumber,
    bankCode,
    bankName,
    recipientCode,
  });
  return res.json({ success: true, data: result });
};

export const updatePayoutMethod = async (req: Request, res: Response) => {
  const result = await paymentService.updatePayoutMethod(req.user!.id, req.body);
  return res.json({ success: true, data: result });
};

export const deletePayoutMethod = async (req: Request, res: Response) => {
  const result = await paymentService.deletePayoutMethod(req.user!.id, req.user!.id);
  return res.json({ success: true, data: result });
};

export const withdraw = async (req: Request, res: Response) => {
  const { amount } = req.body as { amount?: number };
  if (!amount || amount <= 0) throw new AppError(400, "Valid withdrawal amount is required");
  const result = await paymentService.withdrawForProvider({
    providerId: req.user!.id,
    providerUserId: req.user!.id,
    amount: Number(amount),
    initiatedById: req.user!.id,
  });
  return res.status(201).json({ success: true, data: result });
};

export const listWithdrawals = async (req: Request, res: Response) => {
  const page = parseInt(q(req, "page") || "1", 10);
  const limit = parseInt(q(req, "limit") || "20", 10);
  const result = await paymentService.listProviderWithdrawals(req.user!.id, page, limit);
  return res.json({ success: true, data: result });
};

// ----- Admin (company / ledger) -----

export const adminCompanyWallet = async (req: Request, res: Response) => {
  const wallet = await paymentService.getCompanyWallet();
  return res.json({ success: true, data: wallet });
};

export const adminListLedger = async (req: Request, res: Response) => {
  const data = await paymentService.listLedger({
    accountId: q(req, "accountId"),
    refType: q(req, "refType"),
    providerId: q(req, "providerId"),
    page: parseInt(q(req, "page") || "1", 10),
    limit: parseInt(q(req, "limit") || "50", 10),
  });
  return res.json({ success: true, data });
};

export const adminListAccounts = async (req: Request, res: Response) => {
  const accounts = await paymentService.listAccounts();
  const withBalances = await Promise.all(
    accounts.map(async (a) => ({
      ...a,
      balance: a.type === "provider_wallet" && a.ownerId
        ? await paymentService.providerBalanceFor(a.ownerId)
        : await paymentService.companyBalance(a.id),
    })),
  );
  return res.json({ success: true, data: withBalances });
};

export const adminListWithdrawals = async (req: Request, res: Response) => {
  const page = parseInt(q(req, "page") || "1", 10);
  const limit = parseInt(q(req, "limit") || "20", 10);
  const status = q(req, "status");
  const skip = (page - 1) * limit;
  const where = status ? { status: status as never } : {};
  const [items, total] = await Promise.all([
    prisma.payoutRequest.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.payoutRequest.count({ where }),
  ]);
  return res.json({ success: true, data: { items, total, page, limit, totalPages: Math.ceil(total / limit) } });
};

// ----- Admin -----

export const adminListPayments = async (req: Request, res: Response) => {
  const data = await paymentService.listAdminPayments({
    search: q(req, "search"),
    bookingId: q(req, "bookingId"),
    customerId: q(req, "customerId"),
    providerId: q(req, "providerId"),
    status: q(req, "status"),
    type: q(req, "type"),
    page: parseInt(req.query.page as string, 10) || 1,
    limit: parseInt(req.query.limit as string, 10) || 20,
  });
  return res.json({ success: true, data });
};

export const adminGetPayment = (req: Request, res: Response) => getPayment(req, res);

export const adminGetRefund = async (req: Request, res: Response) => {
  const refund = await prisma.refund.findUnique({ where: { id: param(req, "id") } });
  if (!refund) throw new AppError(404, "Refund not found");
  return res.json({ success: true, data: refund });
};

export const adminListRefunds = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const skip = (page - 1) * limit;
  const paymentId = q(req, "paymentId");
  const where = paymentId ? { paymentId } : {};
  const [refunds, total] = await Promise.all([
    prisma.refund.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.refund.count({ where }),
  ]);
  return res.json({ success: true, data: { refunds, total, page, limit, totalPages: Math.ceil(total / limit) } });
};

export const adminListPayouts = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string, 10) || 1;
  const limit = parseInt(req.query.limit as string, 10) || 20;
  const skip = (page - 1) * limit;
  const status = q(req, "status");
  const where = status ? { status: status as PayoutStatus } : {};
  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
    prisma.payout.count({ where }),
  ]);
  return res.json({ success: true, data: { payouts, total, page, limit, totalPages: Math.ceil(total / limit) } });
};

export const adminRecordPayout = async (req: Request, res: Response) => {
  const { paymentId } = req.body as { paymentId?: string };
  if (!paymentId) throw new AppError(400, "paymentId is required");
  const payout = await paymentService.recordPayout(paymentId);
  return res.status(201).json({ success: true, data: payout });
};

// ----- Internal (service-to-service) -----

export const internalCreatePayment = async (req: Request, res: Response) => {
  const { bookingId } = req.body as { bookingId?: string };
  if (!bookingId) throw new AppError(400, "bookingId is required");
  const payment = await paymentService.initializeForBooking(bookingId, {
    id: "internal",
    role: "system",
    source: "internal.booking.created",
  });
  return res.status(201).json({ success: true, data: payment });
};

export const internalGetPayment = async (req: Request, res: Response) => {
  const payment = await paymentService.getById(param(req, "id"));
  return res.json({ success: true, data: payment });
};

export const internalGetByBooking = async (req: Request, res: Response) => {
  const type = (q(req, "type") as "booking" | "tip") || "booking";
  const payment = await paymentService.getByBooking(param(req, "bookingId"), type);
  if (!payment) throw new AppError(404, "Payment not found for booking");
  return res.json({ success: true, data: payment });
};

export const internalVerify = async (req: Request, res: Response) => {
  const payment = await paymentService.verifyPayment(param(req, "id"));
  return res.json({ success: true, data: payment });
};

export const internalRecordPayout = async (req: Request, res: Response) => {
  const { paymentId } = req.body as { paymentId?: string };
  if (!paymentId) throw new AppError(400, "paymentId is required");
  const payout = await paymentService.recordPayout(paymentId);
  return res.status(201).json({ success: true, data: payout });
};

// ----- Webhook -----

export const webhook = async (req: Request, res: Response) => {
  // Raw body must be provided by the raw-body middleware (see index.ts).
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.headers["x-paystack-signature"] as string | undefined;

  if (raw && !verifyWebhookSignature(raw, signature)) {
    throw new AppError(401, "Invalid webhook signature");
  }

  const event = (req.body as { event?: string })?.event || "";
  if (!event) throw new AppError(400, "Missing event");

  await processWebhook({ event, rawPayload: req.body });
  return res.status(200).json({ success: true });
};

// Exported for handler completeness (webhook also allows manual verify fallback)
export const manualVerify = async (req: Request, res: Response) => {
  const payment = await paymentService.getById(param(req, "id"));
  if (payment.paystackRef) {
    await verifyTransaction(payment.paystackRef);
  }
  const result = await paymentService.verifyPayment(payment.id);
  return res.json({ success: true, data: result });
};
