import { createConsumer } from "../utils/kafka";
import { prisma } from "../db/prisma";
import { publishEvent } from "../utils/kafka";
import { recalculateProvider } from "./qualityService";

interface UserRegisteredEvent {
  userId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

interface UserSuspendedEvent {
  userId: string;
}

interface BookingCompletedEvent {
  providerId: string;
  bookingId: string;
}

interface BookingCancelledEvent {
  providerId: string;
  bookingId: string;
  cancelledByRole?: string;
}

export const startKafkaConsumers = async () => {
  await createConsumer("identity.user.registered", async (value) => {
    const event = value as unknown as UserRegisteredEvent;
    if (event.role === "provider") {
      const existing = await prisma.providerProfile.findUnique({
        where: { userId: event.userId },
      });
      if (!existing) {
        await prisma.providerProfile.create({
          data: { userId: event.userId },
        });
        console.log(`[Kafka] Created provider stub for user ${event.userId}`);
      }
    }
  });

  await createConsumer("identity.user.suspended", async (value) => {
    const event = value as unknown as UserSuspendedEvent;
    await prisma.providerProfile.updateMany({
      where: { userId: event.userId },
      data: { status: "deactivated" },
    });
  });

  await createConsumer("booking.completed", async (value) => {
    const event = value as unknown as BookingCompletedEvent;
    const profile = await prisma.providerProfile.findUnique({
      where: { id: event.providerId },
    });
    if (profile) {
      const totalJobs = profile.totalJobs + 1;
      const completedJobs = Math.round(profile.completionRate * profile.totalJobs) + 1;
      const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 1;

      await prisma.providerProfile.update({
        where: { id: event.providerId },
        data: { totalJobs, completionRate },
      });

      if (event.bookingId) {
        await prisma.providerBookingWindow.upsert({
          where: { bookingId: event.bookingId },
          create: {
            providerId: event.providerId,
            bookingId: event.bookingId,
            outcome: "completed",
          },
          update: { outcome: "completed" },
        });
      }

      if (profile.probationaryBookingsRemaining !== null && profile.probationaryBookingsRemaining !== undefined && profile.probationaryBookingsRemaining > 0) {
        await prisma.providerProfile.update({
          where: { id: event.providerId },
          data: { probationaryBookingsRemaining: profile.probationaryBookingsRemaining - 1 },
        });
      }

      await recalculateProvider(event.providerId);
    }
  });

  await createConsumer("booking.cancelled", async (value) => {
    const event = value as unknown as BookingCancelledEvent;
    const profile = await prisma.providerProfile.findUnique({
      where: { id: event.providerId },
    });
    if (profile) {
      const totalJobs = profile.totalJobs + 1;
      const completedJobs = Math.round(profile.completionRate * profile.totalJobs);
      const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 1;

      await prisma.providerProfile.update({
        where: { id: event.providerId },
        data: { totalJobs, completionRate },
      });

      if (event.bookingId) {
        const isProviderCancellation = event.cancelledByRole === "provider";
        await prisma.providerBookingWindow.upsert({
          where: { bookingId: event.bookingId },
          create: {
            providerId: event.providerId,
            bookingId: event.bookingId,
            outcome: isProviderCancellation ? "cancelled_provider" : "cancelled_customer",
          },
          update: {},
        });
      }

      await recalculateProvider(event.providerId);
    }
  });

  console.log("[Kafka] Provider service consumers started");
};
