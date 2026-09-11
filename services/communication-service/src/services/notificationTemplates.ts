import type { NotificationType } from "../../generated/prisma";

export interface NotificationMessage {
  title: string;
  body: string;
}

type TemplateVars = Record<string, string | number | boolean | undefined>;

const T: Record<NotificationType, (vars?: TemplateVars) => NotificationMessage> = {
  booking_confirmed: (v = {}) => ({
    title: "Booking Confirmed",
    body: v.request
      ? "You have a new booking request. Tap to view details."
      : v.serviceName
        ? `Your booking for ${v.serviceName} has been confirmed.`
        : "Your booking has been confirmed.",
  }),
  booking_cancelled: () => ({
    title: "Booking Cancelled",
    body: "A booking has been cancelled.",
  }),
  booking_reminder_24h: (v = {}) => ({
    title: "Booking Reminder",
    body: v.scheduledAt
      ? `Upcoming booking in 24 hours (${v.scheduledAt}).`
      : "You have a booking in 24 hours.",
  }),
  booking_reminder_1h: (v = {}) => ({
    title: "Booking Reminder",
    body: v.scheduledAt
      ? `Upcoming booking in 1 hour (${v.scheduledAt}).`
      : "You have a booking in 1 hour.",
  }),
  provider_en_route: (v = {}) => ({
    title: "Provider En Route",
    body: v.providerName
      ? `${v.providerName} is on their way.`
      : "Your provider is on their way.",
  }),
  booking_started: () => ({
    title: "Service Started",
    body: "Your provider has started the service.",
  }),
  booking_completed: () => ({
    title: "Booking Completed",
    body: "Your service has been completed. Please leave a review!",
  }),
  booking_reassigned: () => ({
    title: "Provider Changed",
    body: "A new provider is being assigned to your booking.",
  }),
  new_review: (v = {}) => ({
    title: "New Review",
    body: v.stars
      ? `You received a new ${v.stars}-star review!`
      : "You received a new review!",
  }),
  payment_received: (v = {}) => ({
    title: "Payment Received",
    body: v.amount
      ? `Your payment of ${v.amount} has been processed.`
      : "Your payment has been processed.",
  }),
  payment_refunded: (v = {}) => ({
    title: "Payment Refunded",
    body: v.amount
      ? `A refund of ${v.amount} has been issued.`
      : "A refund has been issued.",
  }),
  payment_reminder: (v = {}) => ({
    title: "Payment Reminder",
    body: v.amount
      ? `Please complete your payment of ${v.amount}.`
      : "An outstanding payment is due for a completed booking.",
  }),
  dispute_opened: () => ({
    title: "Dispute Opened",
    body: "A dispute has been opened on one of your bookings.",
  }),
  verification_result: (v = {}) => ({
    title: `${v.kind === "service" ? "Service Verification" : "Identity Verification"} ${
      v.approved ? "Approved" : "Rejected"
    }`,
    body:
      v.kind === "service"
        ? v.approved
          ? v.serviceName
            ? `Your service "${v.serviceName}" was approved and is now active.`
            : "Your service was approved and is now active."
          : v.serviceName
            ? `Your service "${v.serviceName}" was not approved.`
            : "Your service was not approved."
        : v.approved
          ? "Your identity verification was approved."
          : "Your identity verification was not approved.",
  }),
  admin_new_signup: (v = {}) => ({
    title: v.role === "provider" ? "New Provider Signup" : "New Customer Signup",
    body: [v.firstName, v.lastName].filter(Boolean).join(" ")
      ? `${[v.firstName, v.lastName].filter(Boolean).join(" ")} just joined${
          v.email ? ` (${v.email})` : ""
        }.`
      : v.email
        ? `A new ${v.role} signed up (${v.email}).`
        : "A new user signed up.",
  }),
  admin_identity_verification_request: () => ({
    title: "Identity Verification Request",
    body: "A provider has submitted identity documents for review.",
  }),
  admin_service_verification_request: (v = {}) => ({
    title: "Service Verification Request",
    body: v.serviceName
      ? `A provider submitted "${v.serviceName}" for review.`
      : "A provider submitted a service for review.",
  }),
  admin_new_booking: (v = {}) => ({
    title: "New Booking Created",
    body: v.serviceName
      ? `A new booking for ${v.serviceName} was created${
          v.scheduledAt ? ` (scheduled ${v.scheduledAt})` : ""
        }.`
      : `A new booking was created${
          v.scheduledAt ? ` (scheduled ${v.scheduledAt})` : ""
        }.`,
  }),
  admin_booking_cancelled: (v = {}) => ({
    title: "Booking Cancelled",
    body: v.reason
      ? `A booking was cancelled (${v.reason}).`
      : "An existing booking was cancelled.",
  }),
  marketing: () => ({
    title: "ElseCallers",
    body: "Check out what's new on ElseCallers.",
  }),
};

export const renderNotification = (
  type: NotificationType,
  vars?: TemplateVars,
): NotificationMessage => T[type](vars);