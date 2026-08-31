import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "8084", 10),
  serviceToken: process.env.SERVICE_TOKEN || "payment-service-internal-token",
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || "handyman-internal-service-token",
  bookingServiceUrl: process.env.BOOKING_SERVICE_URL || "http://localhost:8083",
  identityServiceUrl: process.env.IDENTITY_SERVICE_URL || "http://localhost:8081",
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: "payment-service",
    groupId: "payment-service-group",
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || "sk_test_83ecc76d1ca4c619ef5614ab5afe9261db15d5b6",
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
    baseUrl: process.env.PAYSTACK_BASE_URL || "https://api.paystack.co",
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || "",
    platformFeePct: parseFloat(process.env.PAYSTACK_PLATFORM_FEE_PCT || "15"),
    platformFeeFlat: parseFloat(process.env.PAYSTACK_PLATFORM_FEE_FLAT || "0"),
    currency: process.env.PAYSTACK_CURRENCY || "GHS",
  },
  payouts: {
    minAmount: parseFloat(process.env.PAYOUT_MIN_AMOUNT || "25"),
  },
  clientUrl: process.env.CLIENT_URL || "http://localhost:3000"
} as const;
