import { prisma } from "../db/prisma";
import { config } from "../config/env";
import { createConsumer } from "../utils/kafka";
import { getOrCreateConversation, getConversationByBookingId } from "./conversationService";
import { createNotification } from "./notificationService";
import { renderNotification } from "./notificationTemplates";
import { getAdminRecipients } from "./adminRecipientService";
import type { NotificationChannel, NotificationType } from "../../generated/prisma";

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
  reviewId?: string;
  [key: string]: unknown;
}

interface PaymentEvent {
  userId: string;
  amount?: number;
  [key: string]: unknown;
}

interface DisputeEvent {
  bookingId: string;
  customerId: string;
  reason?: string;
  [key: string]: unknown;
}

/**
 * Create a conversation-scoped system message. Best-effort: events that lack
 * full participant details fall back to the persisted conversation (1:1 with
 * the booking).
 */
const addSystemMessage = async (
  bookingId: string,
  senderId: string,
  content: string,
  participants?: { customerId?: string; providerId?: string },
) => {
  try {
    let conversation =
      participants?.customerId && participants?.providerId
        ? await getOrCreateConversation(
            bookingId,
            participants.customerId,
            participants.providerId,
          )
        : await getConversationByBookingId(bookingId);

    if (!conversation) return null;

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId,
        content,
        type: "system",
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });
    return conversation;
  } catch (error) {
    console.error(`[Kafka] Failed to add system message for booking ${bookingId}:`, error);
    return null;
  }
};

/**
 * Fan out a notification to every resolved admin recipient.
 */
const notifyAdmins = async (
  type: NotificationType,
  channel: NotificationChannel,
  title: string,
  body: string,
  data: Record<string, unknown>,
) => {
  const admins = await getAdminRecipients();
  for (const admin of admins) {
    await createNotification(admin.id, type, channel, title, body, data);
  }
  return admins.length;
};

const fetchServiceName = async (serviceId: string): Promise<string | undefined> => {
  try {
    const res = await fetch(`${config.providerServiceUrl}/internal/services/${serviceId}`, {
      headers: { "x-service-token": config.internalServiceToken },
    });
    if (!res.ok) throw new Error(`provider returned ${res.status}`);
    const json = (await res.json()) as { data?: { name?: string } };
    return json.data?.name;
  } catch (error) {
    console.error(`[Kafka] Failed to resolve service name for ${serviceId}:`, error);
    return undefined;
  }
};

const resolveProviderUserId = async (providerId: string): Promise<string | undefined> => {
  try {
    const res = await fetch(`${config.providerServiceUrl}/internal/providers/${providerId}`, {
      headers: { "x-service-token": config.internalServiceToken },
    });
    if (!res.ok) throw new Error(`provider returned ${res.status}`);
    const json = (await res.json()) as { data?: { userId?: string } };
    return json.data?.userId;
  } catch (error) {
    console.error(`[Kafka] Failed to resolve user id for provider ${providerId}:`, error);
    return undefined;
  }
};

type CreatedBookingEvent = BookingEvent & {
  providerUserId?: string | null;
  invitedProviders?: string[];
  serviceId?: string;
  scheduledAt?: string;
};

type CancelledBookingEvent = BookingEvent & {
  providerUserId?: string | null;
  priorStatus?: string;
  reason?: string;
  cancelledByRole?: string;
  serviceId?: string;
};

type VerificationResultEvent = {
  providerId: string;
  userId?: string;
  providerServiceId?: string;
  serviceId?: string;
  rejectionNote?: string;
};

const consumeVerificationResult = async (
  topics: string[],
  kind: "identity" | "service",
) => {
  for (const topic of topics) {
    await createConsumer(topic, async (value) => {
      const event = value as unknown as VerificationResultEvent;
      const approved = topic.endsWith(".verified");
      const userId = event.userId ?? (await resolveProviderUserId(event.providerId));
      if (!userId) {
        console.warn(`[Kafka] Skipping ${topic}: no user id resolved for provider ${event.providerId}`);
        return;
      }
      const serviceName =
        kind === "service" && event.serviceId
          ? await fetchServiceName(event.serviceId)
          : undefined;
      const { title, body } = renderNotification("verification_result", {
        approved,
        kind,
        serviceName,
      });
      await createNotification(
        userId,
        "verification_result",
        "push",
        title,
        body,
        {
          providerId: event.providerId,
          providerServiceId: event.providerServiceId,
          serviceId: event.serviceId,
          kind,
          approved,
          rejectionNote: event.rejectionNote,
        },
      );
      console.log(`[Kafka] Notified provider ${userId} of ${kind} verification ${approved ? "approval" : "rejection"}`);
    });
  }
};

export const startKafkaConsumers = async () => {
  // Booking created → notify eligible provider(s), notify admin, create conversation
  await createConsumer("booking.created", async (value) => {
    const event = value as unknown as CreatedBookingEvent;

    if (event.customerId && event.providerId) {
      await getOrCreateConversation(
        event.bookingId,
        event.customerId,
        event.providerId,
      );
    }

    const serviceName = event.serviceId
      ? await fetchServiceName(event.serviceId)
      : undefined;
    const { title, body } = renderNotification("booking_confirmed", {
      request: true,
      serviceName,
    });

    const providerRecipients = new Set<string>();
    if (event.providerUserId) providerRecipients.add(event.providerUserId);
    for (const invited of event.invitedProviders ?? []) {
      if (invited) providerRecipients.add(invited);
    }

    for (const providerUserId of providerRecipients) {
      await createNotification(
        providerUserId,
        "booking_confirmed",
        "push",
        title,
        body,
        { bookingId: event.bookingId, serviceId: event.serviceId },
      );
    }

    const { title: adminTitle, body: adminBody } = renderNotification(
      "admin_new_booking",
      { serviceName, scheduledAt: event.scheduledAt },
    );
    const adminCount = await notifyAdmins(
      "admin_new_booking",
      "push",
      adminTitle,
      adminBody,
      {
        bookingId: event.bookingId,
        customerId: event.customerId,
        providerId: event.providerId ?? undefined,
        serviceId: event.serviceId,
        scheduledAt: event.scheduledAt,
        priceQuote: event.priceQuote,
      },
    );
    console.log(
      `[Kafka] Notified ${providerRecipients.size} provider(s) and ${adminCount} admin(s) of booking ${event.bookingId}`,
    );
  });

  // Booking confirmed → notify customer
  await createConsumer("booking.confirmed", async (value) => {
    const event = value as unknown as BookingEvent;
    const { title, body } = renderNotification("booking_confirmed");
    await createNotification(
      event.customerId,
      "booking_confirmed",
      "push",
      title,
      body,
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Notified customer ${event.customerId} of confirmation for booking ${event.bookingId}`);
  });

  // Booking started → notify customer + timestamp in conversation
  await createConsumer("booking.started", async (value) => {
    const event = value as unknown as BookingEvent;
    const { title, body } = renderNotification("booking_started");
    await createNotification(
      event.customerId,
      "booking_started",
      "push",
      title,
      body,
      { bookingId: event.bookingId },
    );
    await addSystemMessage(
      event.bookingId,
      event.providerId,
      "The provider has started the service.",
      { customerId: event.customerId, providerId: event.providerId },
    );
    console.log(`[Kafka] Notified customer of service start for booking ${event.bookingId}`);
  });

  // Booking reassigned → notify customer
  await createConsumer("booking.reassigned", async (value) => {
    const event = value as unknown as BookingStatusEvent;
    const { title, body } = renderNotification("booking_reassigned");
    await createNotification(
      event.customerId as string,
      "booking_reassigned",
      "push",
      title,
      body,
      { bookingId: event.bookingId },
    );
    await addSystemMessage(
      event.bookingId as string,
      event.customerId as string,
      "A new provider is being assigned to this booking.",
      { customerId: event.customerId as string },
    );
    console.log(`[Kafka] Notified customer of reassignment for booking ${event.bookingId}`);
  });

  // Booking completed → notify customer
  await createConsumer("booking.completed", async (value) => {
    const event = value as unknown as BookingStatusEvent;
    const { title, body } = renderNotification("booking_completed");
    await createNotification(
      event.customerId as string,
      "booking_completed",
      "push",
      title,
      body,
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Notified customer of completion for booking ${event.bookingId}`);
  });

  // Booking cancelled → notify customer, accepted provider, and admin
  await createConsumer("booking.cancelled", async (value) => {
    const event = value as unknown as CancelledBookingEvent;
    const { title, body } = renderNotification("booking_cancelled");

    if (event.customerId) {
      await createNotification(
        event.customerId,
        "booking_cancelled",
        "push",
        title,
        body,
        { bookingId: event.bookingId, reason: event.reason },
      );
    }

    const wasAccepted =
      event.priorStatus === "confirmed" || event.priorStatus === "in_progress";
    if (wasAccepted && event.providerUserId) {
      await createNotification(
        event.providerUserId,
        "booking_cancelled",
        "push",
        title,
        body,
        { bookingId: event.bookingId, reason: event.reason },
      );
    }

    const { title: adminTitle, body: adminBody } = renderNotification(
      "admin_booking_cancelled",
      { reason: event.reason },
    );
    const adminCount = await notifyAdmins(
      "admin_booking_cancelled",
      "push",
      adminTitle,
      adminBody,
      {
        bookingId: event.bookingId,
        customerId: event.customerId,
        providerId: event.providerId ?? undefined,
        reason: event.reason,
        cancelledByRole: event.cancelledByRole,
      },
    );
    console.log(
      `[Kafka] Notified customer${wasAccepted ? ", provider" : ""} and ${adminCount} admin(s) of cancellation for booking ${event.bookingId}`,
    );
  });

  // Booking disputed → notify both parties
  await createConsumer("booking.disputed", async (value) => {
    const event = value as unknown as DisputeEvent;
    const { title, body } = renderNotification("dispute_opened");

    await createNotification(
      event.customerId,
      "dispute_opened",
      "push",
      title,
      body,
      { bookingId: event.bookingId, reason: event.reason },
    );

    const conversation = await getConversationByBookingId(event.bookingId);
    if (conversation) {
      await createNotification(
        conversation.providerId,
        "dispute_opened",
        "push",
        title,
        body,
        { bookingId: event.bookingId, reason: event.reason },
      );
    }

    await addSystemMessage(
      event.bookingId,
      event.customerId,
      "A dispute has been opened on this booking.",
      { customerId: event.customerId },
    );
    console.log(`[Kafka] Notified parties of dispute for booking ${event.bookingId}`);
  });

  // Payment required (payment-service on booking.completed) → prompt customer to pay
  await createConsumer("payment.required", async (value) => {
    const event = value as unknown as BookingStatusEvent & { customerId?: string };
    if (!event.customerId) return;
    const { title, body } = renderNotification("payment_reminder");
    await createNotification(
      event.customerId,
      "payment_reminder",
      "push",
      title,
      body,
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Prompted customer to pay for booking ${event.bookingId}`);
  });

  // Payment overdue → reminder to customer
  await createConsumer("booking.payment.overdue", async (value) => {
    const event = value as unknown as BookingStatusEvent;
    const { title, body } = renderNotification("payment_reminder", { overdue: true });
    await createNotification(
      event.customerId as string,
      "payment_reminder",
      "push",
      title,
      body,
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Notified customer of overdue payment for booking ${event.bookingId}`);
  });

  // Payment daily reminder → reminder to customer (rate-limited to 1/day)
  await createConsumer("booking.payment.reminder", async (value) => {
    const event = value as unknown as BookingStatusEvent;
    const { title, body } = renderNotification("payment_reminder");
    await createNotification(
      event.customerId as string,
      "payment_reminder",
      "push",
      title,
      body,
      { bookingId: event.bookingId },
    );
    console.log(`[Kafka] Sent payment reminder for booking ${event.bookingId}`);
  });

  // Review submitted → notify provider
  await createConsumer("provider.review.submitted", async (value) => {
    const event = value as unknown as ReviewEvent & { userId?: string };
    const userId = event.userId ?? (event.providerId ? await resolveProviderUserId(event.providerId) : undefined);
    if (!userId) return;
    const { title, body } = renderNotification("new_review");
    await createNotification(
      userId,
      "new_review",
      "push",
      title,
      body,
      { reviewId: event.reviewId },
    );
    console.log(`[Kafka] Notified provider ${userId} of new review`);
  });

  // Provider identity verification result → notify provider
  await consumeVerificationResult(
    ["provider.identity.verified", "provider.identity.rejected"],
    "identity",
  );

  // Provider service verification result → notify provider
  await consumeVerificationResult(
    ["provider.service.verified", "provider.service.rejected"],
    "service",
  );

  // Payment captured → receipt notification
  await createConsumer("payment.captured", async (value) => {
    const event = value as unknown as PaymentEvent;
    const { title, body } = renderNotification("payment_received", { amount: event.amount });
    await createNotification(
      event.userId,
      "payment_received",
      "email",
      title,
      body,
      {},
    );
    console.log(`[Kafka] Sent payment receipt to ${event.userId}`);
  });

  // New customer/provider signup → notify admins
  await createConsumer("identity.user.registered", async (value) => {
    const event = value as unknown as {
      userId: string;
      email?: string;
      role?: string;
      firstName?: string;
      lastName?: string;
    };
    if (!event.role || (event.role !== "customer" && event.role !== "provider")) {
      return;
    }
    const { title, body } = renderNotification("admin_new_signup", {
      role: event.role,
      email: event.email,
      firstName: event.firstName,
      lastName: event.lastName,
    });
    const count = await notifyAdmins(
      "admin_new_signup",
      "push",
      title,
      body,
      { userId: event.userId, email: event.email, role: event.role },
    );
    console.log(`[Kafka] Notified ${count} admin(s) of new ${event.role} signup ${event.userId}`);
  });

  // Provider identity verification requested → notify admins
  await createConsumer("provider.identity.verification.requested", async (value) => {
    const event = value as unknown as { providerId: string; userId?: string };
    const { title, body } = renderNotification("admin_identity_verification_request");
    const count = await notifyAdmins(
      "admin_identity_verification_request",
      "push",
      title,
      body,
      { providerId: event.providerId, userId: event.userId },
    );
    console.log(`[Kafka] Notified ${count} admin(s) of identity verification request for provider ${event.providerId}`);
  });

  // Provider service verification requested → notify admins
  await createConsumer("provider.service.submitted", async (value) => {
    const event = value as unknown as {
      providerId: string;
      providerServiceId: string;
      serviceId: string;
    };
    const serviceName = await fetchServiceName(event.serviceId);
    const { title, body } = renderNotification("admin_service_verification_request", {
      serviceName,
    });
    const count = await notifyAdmins(
      "admin_service_verification_request",
      "push",
      title,
      body,
      { providerId: event.providerId, providerServiceId: event.providerServiceId, serviceId: event.serviceId },
    );
    console.log(`[Kafka] Notified ${count} admin(s) of service verification request for provider ${event.providerId}`);
  });

  console.log("[Kafka] Communication service consumers started");
};