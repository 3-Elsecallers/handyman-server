import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "8085", 10),
  serviceToken: process.env.SERVICE_TOKEN || "communication-service-internal-token",
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || "handyman-internal-service-token",
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || "dev-access-secret-change-me",
  identityServiceUrl: process.env.IDENTITY_SERVICE_URL || "http://localhost:8081",
  bookingServiceUrl: process.env.BOOKING_SERVICE_URL || "http://localhost:8083",
  providerServiceUrl: process.env.PROVIDER_SERVICE_URL || "http://localhost:8082",
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: "communication-service",
    groupId: "communication-service-group",
  },
  s3: {
    bucket: process.env.AWS_S3_BUCKET || "handyman-bucket",
    region: process.env.AWS_REGION || "us-east-1",
    endpoint: process.env.AWS_S3_ENDPOINT || "http://localhost:4566",
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
  notification: {
    rateLimit: parseInt(process.env.NOTIFICATION_RATE_LIMIT || "10", 10),
    rateWindowMs: parseInt(process.env.NOTIFICATION_RATE_WINDOW_MS || "60000", 10),
    sweepIntervalMs: parseInt(process.env.NOTIFICATION_SWEEP_INTERVAL_MS || "15000", 10),
    fromEmail: process.env.NOTIFICATION_FROM_EMAIL || "no-reply@elsecallers.com",
    adminRecipientIds: (process.env.ADMIN_NOTIFICATION_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
    providers: {
      push: {
        serviceAccountPath: process.env.FCM_SERVICE_ACCOUNT_PATH || "",
        projectId: process.env.FCM_PROJECT_ID || "",
      },
      email: {
        host: process.env.SMTP_HOST || "",
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        user: process.env.SMTP_USER || "",
        pass: process.env.SMTP_PASS || "",
      },
      sms: {
        apiKey: process.env.SMS_API_KEY || "",
      },
    },
  },
} as const;
