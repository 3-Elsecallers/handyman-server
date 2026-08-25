import { createConsumer } from "../utils/kafka";
import { getOrCreateConversation } from "./conversationService";
import { createNotification } from "./notificationService";

interface BookingEvent {
  bookingId: string;
  customerId: string;
  providerId: string;
  [key: string]: unknown;
}

interface BookingStatusEvent {
  bookingId: string;
  [key: string]: unknown;
}

interface ReviewEvent {
  providerId: string;
  [key: string]: unknown;
}

interface PaymentEvent {
  userId: string;
  amount?: number;
  [key: string]: unknown;
}

export const startKafkaConsumers = async () => {
  // Booking created → notify provider, create conversation
  await createConsumer("booking.created", async (value) => {
    const event = value as unknown as BookingEvent;
    await getOrCreateConversation(
      event.bookingId,
      event.customerId,
      event.providerId,
    );
    await createNotification(
      event.providerId,
      "booking_confirmed",
      "push",
      "New Booking Request",
      "You have a new booking request. Tap to view details.",
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Notified provider ${event.providerId} of booking ${event.bookingId}`);
  });

  // Booking confirmed → notify customer
  await createConsumer("booking.confirmed", async (value) => {
    const event = value as unknown as BookingEvent;
    await createNotification(
      event.customerId,
      "booking_confirmed",
      "push",
      "Booking Confirmed",
      "Your booking has been confirmed!",
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Notified customer ${event.customerId} of confirmation for booking ${event.bookingId}`);
  });

  // Booking completed → notify customer
  await createConsumer("booking.completed", async (value) => {
    const event = value as unknown as BookingStatusEvent;
    await createNotification(
      event.customerId as string,
      "booking_completed",
      "push",
      "Booking Completed",
      "Your service has been completed. Please leave a review!",
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Notified customer of completion for booking ${event.bookingId}`);
  });

  // Booking cancelled → notify both parties
  await createConsumer("booking.cancelled", async (value) => {
    const event = value as unknown as BookingEvent;
    await createNotification(
      event.customerId,
      "booking_cancelled" as never,
      "push",
      "Booking Cancelled",
      "A booking has been cancelled.",
      { bookingId: event.bookingId },
    );
    await createNotification(
      event.providerId,
      "booking_cancelled" as never,
      "push",
      "Booking Cancelled",
      "A booking has been cancelled.",
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Notified both parties of cancellation for booking ${event.bookingId}`);
  });

  // Review submitted → notify provider
  await createConsumer("provider.review.submitted", async (value) => {
    const event = value as unknown as ReviewEvent;
    await createNotification(
      event.providerId,
      "new_review",
      "push",
      "New Review",
      "You received a new review!",
      {},
    );
    console.log(`[Kafka] Notified provider ${event.providerId} of new review`);
  });

  // Payment captured → receipt notification
  await createConsumer("payment.captured", async (value) => {
    const event = value as unknown as PaymentEvent;
    await createNotification(
      event.userId,
      "payment_received",
      "email",
      "Payment Received",
      `Your payment of $${event.amount ?? ""} has been processed.`,
      {},
    );
    console.log(`[Kafka] Sent payment receipt to ${event.userId}`);
  });

  console.log("[Kafka] Communication service consumers started");
};
