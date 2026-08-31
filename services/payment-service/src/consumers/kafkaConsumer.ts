import { prisma } from "../db/prisma";
import { createConsumer } from "../utils/kafka";
import { getByBooking, capturePayment, refundPayment } from "../services/paymentService";

/**
 * Reacts to booking-service lifecycle events.
 *
 *  - booking.cancelled: the single point where refunds are issued (payment
 *    service owns refunds per the approved flow). A `pending` payment is voided
 *    (failed); a `paid` payment is refunded using the refundAmount supplied in
 *    the booking-cancelled event (falls back to the full refundable base).
 *  - booking.confirmed: gets the payment record in sync (the internal
 *    POST /internal/payments path from booking-service usually handles this,
 *    so this is a safety net for idempotency).
 *
 * All handlers are idempotent.
 */
export const startConsumers = async () => {
  await createConsumer("booking.cancelled", async (value) => {
    const event = value as Record<string, unknown>;
    const bookingId = event.bookingId as string | undefined;
    if (!bookingId) return;

    const payment = await getByBooking(bookingId, "booking");
    if (!payment) return;

    if (payment.status === "pending" || payment.status === "authorized") {
      // Void any not-yet-captured charge so no later capture can succeed.
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: "failed", failedAt: new Date() },
      });
      return;
    }

    if (payment.status === "paid") {
      const refundAmount = event.refundAmount as number | undefined;
      try {
        await refundPayment(payment.id, {
          amount: refundAmount != null ? Number(refundAmount) : undefined,
          reason: (event.reason as string | undefined) || "Booking cancelled",
          initiator: { id: "system", role: "system" },
        });
      } catch (error) {
        console.error(`[Payment] Refund failed for booking ${bookingId}:`, error);
      }
    }
  });

  await createConsumer("booking.confirmed", async (value) => {
    const bookingId = (value as Record<string, unknown>).bookingId as string | undefined;
    if (!bookingId) return;

    const payment = await getByBooking(bookingId, "booking");
    // If a payment reference exists but isn't marked paid, finalize it via a
    // paystack verify. This is a safety net; normal flow uses the webhook.
    if (payment && payment.paystackRef && payment.status === "pending") {
      await capturePayment(payment.paystackRef).catch(() => {
        // No-op: webhook/verify flow will reconcile, or a genuine failure
        // will be surfaced by an explicit verify call.
      });
    }
  });
};
