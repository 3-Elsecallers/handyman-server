import { prisma } from "../db/prisma";
import { createConsumer, publishEvent } from "../utils/kafka";
import { validateProviderAvailability } from "../utils/serviceClient";

interface PaymentCapturedEvent {
  paymentId?: string;
  bookingId: string;
  amount?: number;
  providerEarning?: number;
}

interface PaymentRefundedEvent {
  paymentId?: string;
  bookingId: string;
  refundAmount?: number;
  reason?: string;
}

interface AvailabilityChangedEvent {
  providerId: string;
}

interface UserSuspendedEvent {
  userId: string;
}

export const startKafkaConsumers = async () => {
  // Confirm payment received for a booking
  await createConsumer("payment.captured", async (value) => {
    const event = value as unknown as PaymentCapturedEvent;
    if (!event.bookingId) return;
    console.log(`[Kafka] Payment captured for booking ${event.bookingId}`);
  });

  // Update booking with refund status
  await createConsumer("payment.refunded", async (value) => {
    const event = value as unknown as PaymentRefundedEvent;
    if (!event.bookingId) return;
    await prisma.booking.updateMany({
      where: { id: event.bookingId },
      data: {
        ...(event.refundAmount != null ? { refundAmount: event.refundAmount } : {}),
      },
    });
    console.log(`[Kafka] Refund recorded for booking ${event.bookingId}`);
  });

  // Revalidate pending bookings when a provider's availability changes
  await createConsumer("provider.availability.changed", async (value) => {
    const event = value as unknown as AvailabilityChangedEvent;
    if (!event.providerId) return;

    const pending = await prisma.booking.findMany({
      where: { providerId: event.providerId, status: "pending" },
    });

    for (const booking of pending) {
      const durationMins = booking.durationMins ?? 60;
      const { available } = await validateProviderAvailability(
        event.providerId,
        booking.scheduledAt.toISOString(),
        durationMins,
      );
      if (!available && Date.now() < booking.scheduledAt.getTime()) {
        await prisma.booking.update({
          where: { id: booking.id },
          data: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledBy: "system",
            cancellationReason: "Provider no longer available for scheduled time",
          },
        });
        await prisma.bookingTimeline.create({
          data: {
            bookingId: booking.id,
            status: "cancelled",
            actorId: "system",
            actorRole: "system",
            note: "Cancelled due to provider availability change",
          },
        });
        await publishEvent("booking.cancelled", booking.id, {
          bookingId: booking.id,
          cancelledBy: "system",
          reason: "Provider no longer available",
          refundAmount: 0,
        });
      }
    }
  });

  // Handle suspended users - cancel their active bookings
  await createConsumer("identity.user.suspended", async (value) => {
    const event = value as unknown as UserSuspendedEvent;
    if (!event.userId) return;

    const active = await prisma.booking.findMany({
      where: {
        OR: [{ customerId: event.userId }],
        status: { in: ["pending", "confirmed"] },
      },
    });

    for (const booking of active) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: {
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledBy: "system",
          cancellationReason: "Account suspended",
        },
      });
      await prisma.bookingTimeline.create({
        data: {
          bookingId: booking.id,
          status: "cancelled",
          actorId: "system",
          actorRole: "system",
          note: "Cancelled due to account suspension",
        },
      });
      await publishEvent("booking.cancelled", booking.id, {
        bookingId: booking.id,
        cancelledBy: "system",
        reason: "Account suspended",
        refundAmount: 0,
      });
    }
  });

  console.log("[Kafka] Booking service consumers started");
};
