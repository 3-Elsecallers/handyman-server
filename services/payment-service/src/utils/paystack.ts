import crypto from "crypto";
import { config } from "../config/env";
import { AppError } from "../middlewares/errorHandler.middleware";

/**
 * Isolated Paystack client. Nothing outside this module (and its service
 * wrapper) talks to Paystack directly.
 *
 * Amounts are converted to the smallest currency unit (pesewas/kobo) as
 * Paystack requires. When a Paystack secret key is not configured (local dev),
 * transactions can still be recorded as `pending` with a locally-generated
 * reference, but verification/refund/transfer calls will fail with a clear
 * error rather than silently succeeding.
 */

const toMinor = (amount: number): number =>
  Math.round(amount * 100);

interface PaystackApiMessage {
  status: boolean;
  message?: string;
  data?: Record<string, unknown>;
}

async function paystackRequest<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  if (!config.paystack.secretKey) {
    throw new AppError(503, "Paystack is not configured (PAYSTACK_SECRET_KEY missing)");
  }

  const res = await fetch(`${config.paystack.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.paystack.secretKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as PaystackApiMessage;

  if (!res.ok || json.status === false) {
    throw new AppError(502, json.message || `Paystack request failed (${res.status})`);
  }

  return json.data as T;
}

export interface InitializeResult {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export const initializeTransaction = async (input: {
  email: string;
  amount: number;
  reference: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> => {
  return paystackRequest<InitializeResult>("POST", "/transaction/initialize", {
    email: input.email,
    amount: toMinor(input.amount),
    reference: input.reference,
    ...(input.callback_url ? { callback_url: input.callback_url } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    currency: config.paystack.currency,
  });
};

export interface VerifyResult {
  id: number;
  status: string;
  reference: string;
  amount: number;
  paid_at?: string | null;
  customer?: { email?: string; customer_code?: string } | null;
}

export const verifyTransaction = async (reference: string): Promise<VerifyResult> => {
  return paystackRequest<VerifyResult>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);
};

export interface PaystackRefundInput {
  reference: string;
  amount?: number;
}

export const refundTransaction = async (input: PaystackRefundInput): Promise<Record<string, unknown>> => {
  return paystackRequest("POST", "/transaction/refund", {
    transaction: input.reference,
    ...(input.amount != null ? { amount: toMinor(input.amount) } : {}),
  });
};

export const createTransfer = async (input: {
  amount: number;
  recipient: string;
  reason: string;
  source: string;
  reference: string;
}): Promise<Record<string, unknown>> => {
  return paystackRequest("POST", "/transfer", {
    amount: toMinor(input.amount),
    recipient: input.recipient,
    reason: input.reason,
    source: input.source,
    reference: input.reference,
    currency: config.paystack.currency,
  });
};

/**
 * Verifies a Paystack webhook signature. Paystack signs the raw request body
 * with an HMAC-SHA512 using the webhook/secret key.
 */
export const verifyWebhookSignature = (rawBody: Buffer, signature: string | undefined): boolean => {
  const secret = config.paystack.webhookSecret || config.paystack.secretKey;
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(hmac, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
