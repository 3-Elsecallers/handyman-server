import { prisma } from "../db/prisma";
import { publishEvent } from "../utils/kafka";

/**
 * Overdue payment scheduler (booking-service owns the Booking table).
 *
 * After a booking is completed, the customer has a 24h payment window
 * (paymentDueAt). Completed bookings that remain unpaid past the window are
 * flagged `paymentOverdue` and a reminder event is published. Reminders are
 * capped at 1 per day for 3 days (enforced downstream by the
 * communication-service); this job republishes daily while overdue.
 */

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
const REMINDER_DAY_MS = 24 * 60 * 60 * 1000;

const OVERDUE_STATUSES = ["pending", "cash_outstanding"] as const;

export const markOverdueBookings = async () => {
  const now = new Date();
  const overdue = await prisma.booking.findMany({
    where: {
      status: "completed",
      paymentOverdue: false,
      paymentStatus: { in: [...OVERDUE_STATUSES] },
      paymentDueAt: { not: null, lte: now },
    },
    select: { id: true, customerId: true, providerId: true, paymentMethod: true, paymentDueAt: true, paymentOverdue: true },
  });

  for (const booking of overdue) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentOverdue: true },
    });
    await publishEvent("booking.payment.overdue", booking.id, {
      bookingId: booking.id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      paymentMethod: booking.paymentMethod,
      dueAt: booking.paymentDueAt?.toISOString(),
    });
  }

  // Republish daily reminders for still-overdue bookings (1/day cadence).
  const stillOverdue = await prisma.booking.findMany({
    where: {
      status: "completed",
      paymentOverdue: true,
      paymentStatus: { in: [...OVERDUE_STATUSES] },
    },
    select: { id: true, customerId: true, providerId: true, paymentMethod: true, paymentDueAt: true },
  });
  for (const booking of stillOverdue) {
    await publishEvent("booking.payment.reminder", booking.id, {
      bookingId: booking.id,
      customerId: booking.customerId,
      providerId: booking.providerId,
      paymentMethod: booking.paymentMethod,
      dueAt: booking.paymentDueAt?.toISOString(),
    });
  }

  void REMINDER_DAY_MS;
  return { newlyOverdue: overdue.length, reminders: stillOverdue.length };
};

export const startScheduler = () => {
  const run = async () => {
    try {
      await markOverdueBookings();
    } catch (error) {
      console.error("[Booking] Overdue scheduler failed:", error);
    }
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
  console.log("[Booking] Overdue scheduler started");
};
