import { prisma } from "../db/prisma";
import { LedgerAccountType, LedgerEntryType, Prisma } from "../../generated/prisma";

/**
 * Double-entry ledger for the payments domain.
 *
 * Accounts:
 *  - collected       (singleton) incoming online money before allocation
 *  - platform_fee    (singleton) platform fees (online + cash_fee) owned by the company
 *  - reserve         (singleton) held funds (10% of provider earning for 24h)
 *  - provider_wallet (per provider) provider balances
 *
 * Posting model: each movement is written as ONE LedgerEntry row with a `credit`
 * (money into `accountId`) or `debit` (money out of `accountId`); `counterpartyId`
 * references the opposing account for auditability but balance is always derived
 * from `accountId` as  SUM(credits) - SUM(debits).
 *
 * Idempotency: the unique(entry) key is (refType, refId, type, accountId), so a
 * retried movement for the same source row is a no-op.
 */

export const ACCOUNT_COLLECTED = "collected";
export const ACCOUNT_PLATFORM_FEE = "platform_fee";
export const ACCOUNT_RESERVE = "reserve";
const CURRENCY = "GHS";

export const accountId = (type: LedgerAccountType, ownerId?: string | null): string => {
  if (type === "provider_wallet") {
    if (!ownerId) throw new Error("provider_wallet account requires an ownerId");
    return `provider_wallet:${ownerId}`;
  }
  return type; // singleton accounts use their type as a stable id
};

export const resolveAccount = async (
  type: LedgerAccountType,
  ownerId?: string | null,
  tx: Prisma.TransactionClient = prisma,
) => {
  const existing = await tx.ledgerAccount.findFirst({
    where: { type, ownerId: ownerId ?? null },
  });
  if (existing) return existing;
  try {
    return await tx.ledgerAccount.create({
      data: { id: accountId(type, ownerId), type, ownerId: ownerId ?? null, currency: CURRENCY },
    });
  } catch (error) {
    // Concurrent create race — re-read and return the winner.
    const winner = await tx.ledgerAccount.findFirst({
      where: { type, ownerId: ownerId ?? null },
    });
    if (winner) return winner;
    throw error;
  }
};

/**
 * Posts a single movement (credit into or debit out of `accountId`).
 * Idempotent on (refType, refId, type, accountId).
 */
export const post = async (input: {
  type: LedgerEntryType;
  refType: string;
  refId: string;
  accountId: string;
  credit?: number;
  debit?: number;
  counterpartyId?: string;
  tx?: Prisma.TransactionClient;
}) => {
  const tx = input.tx ?? prisma;
  const credit = input.credit ?? 0;
  const debit = input.debit ?? 0;
  if (credit < 0 || debit < 0) throw new Error("credit and debit must be non-negative");
  if ((credit > 0 && debit > 0) || (credit === 0 && debit === 0)) {
    throw new Error("Each ledger entry must be exactly a credit OR a debit");
  }

  const existing = await tx.ledgerEntry.findUnique({
    where: {
      refType_refId_type_accountId: {
        refType: input.refType,
        refId: input.refId,
        type: input.type,
        accountId: input.accountId,
      },
    },
  });
  if (existing) return existing;

  return tx.ledgerEntry.create({
    data: {
      accountId: input.accountId,
      counterpartyId: input.counterpartyId ?? null,
      type: input.type,
      credit,
      debit,
      currency: CURRENCY,
      refType: input.refType,
      refId: input.refId,
    },
  });
};

const balanceOf = async (id: string, tx: Prisma.TransactionClient = prisma): Promise<number> => {
  const agg = await tx.ledgerEntry.aggregate({
    where: { accountId: id },
    _sum: { credit: true, debit: true },
  });
  return Math.round(((agg._sum.credit ?? 0) - (agg._sum.debit ?? 0)) * 100) / 100;
};

export const providerBalance = async (providerId: string): Promise<number> => {
  const acct = await resolveAccount("provider_wallet", providerId);
  return balanceOf(acct.id);
};

export const accountBalance = async (id: string): Promise<number> => balanceOf(id);

/**
 * Online payment capture posting:
 *   collected -> provider_wallet (net earning after hold)  [payment_allocated]
 *   collected -> platform_fee    (platformFee)             [platform_fee]
 *   collected -> reserve         (hold)                    [hold]
 */
export const postOnlineAllocation = async (input: {
  paymentId: string;
  providerId: string | null;
  providerEarning: number;
  platformFee: number;
  holdPct?: number;
  tx?: Prisma.TransactionClient;
}) => {
  const tx = input.tx ?? prisma;
  const holdPct = input.holdPct ?? 0.1;
  const hold = Math.round(input.providerEarning * holdPct * 100) / 100;
  const netEarning = Math.round((input.providerEarning - hold) * 100) / 100;
  const refType = "Payment";
  const refId = input.paymentId;

  await resolveAccount("collected", null, tx);
  await resolveAccount("platform_fee", null, tx);
  await resolveAccount("reserve", null, tx);
  if (input.providerId) await resolveAccount("provider_wallet", input.providerId, tx);

  await post({ type: "payment_allocated", refType, refId, accountId: ACCOUNT_COLLECTED, debit: input.providerEarning, counterpartyId: input.providerId ? accountId("provider_wallet", input.providerId) : undefined, tx });
  if (input.providerId) {
    await post({ type: "payment_allocated", refType, refId, accountId: accountId("provider_wallet", input.providerId), credit: netEarning, counterpartyId: ACCOUNT_COLLECTED, tx });
  }
  await post({ type: "platform_fee", refType, refId, accountId: ACCOUNT_COLLECTED, debit: input.platformFee, counterpartyId: ACCOUNT_PLATFORM_FEE, tx });
  await post({ type: "platform_fee", refType, refId, accountId: ACCOUNT_PLATFORM_FEE, credit: input.platformFee, counterpartyId: ACCOUNT_COLLECTED, tx });
  await post({ type: "hold", refType, refId, accountId: ACCOUNT_COLLECTED, debit: hold, counterpartyId: ACCOUNT_RESERVE, tx });
  await post({ type: "hold", refType, refId, accountId: ACCOUNT_RESERVE, credit: hold, counterpartyId: ACCOUNT_COLLECTED, tx });
};

/**
 * Cash payment posting: provider pays the platform fee from their wallet.
 * Money never entered `collected`.
 */
export const postCashFee = async (input: {
  paymentId: string;
  providerId: string | null;
  platformFee: number;
  tx?: Prisma.TransactionClient;
}) => {
  const tx = input.tx ?? prisma;
  if (!input.providerId || input.platformFee <= 0) return;

  await resolveAccount("provider_wallet", input.providerId, tx);
  await resolveAccount("platform_fee", null, tx);

  const refType = "Payment";
  const refId = input.paymentId;
  await post({ type: "cash_fee", refType, refId, accountId: accountId("provider_wallet", input.providerId), debit: input.platformFee, counterpartyId: ACCOUNT_PLATFORM_FEE, tx });
  await post({ type: "cash_fee", refType, refId, accountId: ACCOUNT_PLATFORM_FEE, credit: input.platformFee, counterpartyId: accountId("provider_wallet", input.providerId), tx });
};

/**
 * Tip posting: 100% to provider wallet, no hold, no fee.
 */
export const postTip = async (input: {
  paymentId: string;
  providerId: string | null;
  amount: number;
  tx?: Prisma.TransactionClient;
}) => {
  const tx = input.tx ?? prisma;
  if (!input.providerId) return;

  await resolveAccount("collected", null, tx);
  await resolveAccount("provider_wallet", input.providerId, tx);

  const refType = "Tip";
  const refId = input.paymentId;
  await post({ type: "tip", refType, refId, accountId: ACCOUNT_COLLECTED, debit: input.amount, counterpartyId: accountId("provider_wallet", input.providerId), tx });
  await post({ type: "tip", refType, refId, accountId: accountId("provider_wallet", input.providerId), credit: input.amount, counterpartyId: ACCOUNT_COLLECTED, tx });
};

/**
 * Releases a hold (reserve -> provider_wallet) once 24h has elapsed.
 */
export const releaseHold = async (input: {
  paymentId: string;
  providerEarning: number;
  providerId: string | null;
  holdPct?: number;
  tx?: Prisma.TransactionClient;
}) => {
  const tx = input.tx ?? prisma;
  const holdPct = input.holdPct ?? 0.1;
  const hold = Math.round(input.providerEarning * holdPct * 100) / 100;
  if (hold <= 0 || !input.providerId) return;

  await resolveAccount("reserve", null, tx);
  await resolveAccount("provider_wallet", input.providerId, tx);

  const refType = "ReserveRelease";
  const refId = input.paymentId;
  await post({ type: "release", refType, refId, accountId: ACCOUNT_RESERVE, debit: hold, counterpartyId: accountId("provider_wallet", input.providerId), tx });
  await post({ type: "release", refType, refId, accountId: accountId("provider_wallet", input.providerId), credit: hold, counterpartyId: ACCOUNT_RESERVE, tx });
};

/**
 * Refund reversal: reverses online allocation back to collected, keyed on the
 * Refund row.
 */
export const postRefundReversal = async (input: {
  refundId: string;
  providerId: string | null;
  providerEarning: number;
  platformFee: number;
  hold: number;
  holdPct?: number;
  tx?: Prisma.TransactionClient;
}) => {
  const tx = input.tx ?? prisma;
  const holdPct = input.holdPct ?? 0.1;
  const hold = input.hold > 0 ? input.hold : Math.round(input.providerEarning * holdPct * 100) / 100;
  const netEarning = Math.round((input.providerEarning - hold) * 100) / 100;
  const refType = "Refund";
  const refId = input.refundId;

  await resolveAccount("collected", null, tx);
  await resolveAccount("platform_fee", null, tx);
  await resolveAccount("reserve", null, tx);
  if (input.providerId) await resolveAccount("provider_wallet", input.providerId, tx);

  if (input.providerId && netEarning > 0) {
    await post({ type: "refund", refType, refId, accountId: accountId("provider_wallet", input.providerId), debit: netEarning, counterpartyId: ACCOUNT_COLLECTED, tx });
    await post({ type: "refund", refType, refId, accountId: ACCOUNT_COLLECTED, credit: netEarning, counterpartyId: accountId("provider_wallet", input.providerId), tx });
  }
  if (input.platformFee > 0) {
    await post({ type: "refund", refType, refId, accountId: ACCOUNT_PLATFORM_FEE, debit: input.platformFee, counterpartyId: ACCOUNT_COLLECTED, tx });
    await post({ type: "refund", refType, refId, accountId: ACCOUNT_COLLECTED, credit: input.platformFee, counterpartyId: ACCOUNT_PLATFORM_FEE, tx });
  }
  if (hold > 0) {
    await post({ type: "refund", refType, refId, accountId: ACCOUNT_RESERVE, debit: hold, counterpartyId: ACCOUNT_COLLECTED, tx });
    await post({ type: "refund", refType, refId, accountId: ACCOUNT_COLLECTED, credit: hold, counterpartyId: ACCOUNT_RESERVE, tx });
  }
};
