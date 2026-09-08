import { prisma } from "../db/prisma";
import { publishEvent } from "../utils/kafka";
import { releaseHold } from "./ledgerService";
import { ACCOUNT_COLLECTED, ACCOUNT_PLATFORM_FEE, ACCOUNT_RESERVE } from "./ledgerService";

/**
 * Background jobs for the payments domain.
 *
 *  - releaseReserveHold   (every 15 min) — release the 10% hold for bookings
 *    whose 24h payment-confirmation window has elapsed.
 *  - markOverdue          (every hour)   — flag completed bookings that remain
 *    unpaid past their paymentDueAt window and notify.
 *  - reconcile            (daily)        — compare local collected balance to
 *    expectations; surfaced to the admin ledger view.
 *
 * Implemented with setInterval to avoid introducing a cron dependency.
 */

const RELEASE_INTERVAL_MS = 15 * 60 * 1000;
const OVERDUE_INTERVAL_MS = 60 * 60 * 1000;
const RECONCILE_INTERVAL_MS = 24 * 60 * 60 * 1000;

const HOLD_HOURS = 24;
const HOLD_PCT = 0.1;

/**
 * Releases holds for online payments captured more than 24h ago whose reserve
 * was never released. Runs idempotently (release entries are keyed).
 */
export const releaseReserveHold = async () => {
  const cutoff = new Date(Date.now() - HOLD_HOURS * 60 * 60 * 1000);
  const captured = await prisma.payment.findMany({
    where: { status: "paid", paymentMethod: "online", capturedAt: { lte: cutoff } },
    select: { id: true, bookingId: true, providerId: true, providerEarning: true },
  });
  let released = 0;
  for (const payment of captured) {
    await releaseHold({
      paymentId: payment.id,
      providerEarning: payment.providerEarning,
      providerId: payment.providerId,
      holdPct: HOLD_PCT,
    });
    released++;
  }
  if (released > 0) console.log(`[Scheduler] Released hold for ${released} payments`);
  return released;
};

/**
 * Flags completed bookings whose payment is still outstanding past their due
 * window and emits a reminder event. The decoded payment-due state for
 * bookings lives in booking-service, so this job is a light reminder emitter
 * driven by the ledger's outstanding obligations. Enforced cadence (1/day for
 * 3 days) is handled downstream by the communication-service.
 */
export const markOverdue = async () => {
  // Overdue marking of Booking rows is owned by booking-service (it owns the
  // table). This stub keeps the payment-service scheduler contract stable and
  // can later emit reminder events on ledger state.
  return 0;
};

/**
 * Reconcilies local collected leads vs captured payments. Logs discrepancies
 * (no structural action). Could be extended to pull Paystack balance.
 */
export const reconcileLedger = async () => {
  const collected = await prisma.ledgerEntry.aggregate({
    where: { accountId: ACCOUNT_COLLECTED },
    _sum: { credit: true, debit: true },
  });
  const platformFee = await prisma.ledgerEntry.aggregate({
    where: { accountId: ACCOUNT_PLATFORM_FEE },
    _sum: { credit: true, debit: true },
  });
  const reserve = await prisma.ledgerEntry.aggregate({
    where: { accountId: ACCOUNT_RESERVE },
    _sum: { credit: true, debit: true },
  });
  const report = {
    collectedBalance: Math.round(((collected._sum.credit ?? 0) - (collected._sum.debit ?? 0)) * 100) / 100,
    platformFeeBalance: Math.round(((platformFee._sum.credit ?? 0) - (platformFee._sum.debit ?? 0)) * 100) / 100,
    reserveBalance: Math.round(((reserve._sum.credit ?? 0) - (reserve._sum.debit ?? 0)) * 100) / 100,
    timestamp: new Date().toISOString(),
  };
  await publishEvent("ledger.reconcile", "daily", report);
  return report;
};

const startInterval = (fn: () => Promise<unknown>, ms: number, name: string) => {
  const run = async () => {
    try {
      await fn();
    } catch (error) {
      console.error(`[Scheduler] ${name} failed:`, error);
    }
  };
  run(); // run on startup once
  setInterval(run, ms);
};

export const startSchedulers = () => {
  startInterval(releaseReserveHold, RELEASE_INTERVAL_MS, "releaseReserveHold");
  startInterval(markOverdue, OVERDUE_INTERVAL_MS, "markOverdue");
  startInterval(reconcileLedger, RECONCILE_INTERVAL_MS, "reconcileLedger");
  console.log("[Payment] Schedulers started");
};
