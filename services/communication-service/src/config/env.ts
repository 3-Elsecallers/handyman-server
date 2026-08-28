import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "8085", 10),
  serviceToken: process.env.SERVICE_TOKEN || "communication-service-internal-token",
  internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || "handyman-internal-service-token",
  identityServiceUrl: process.env.IDENTITY_SERVICE_URL || "http://localhost:8081",
  bookingServiceUrl: process.env.BOOKING_SERVICE_URL || "http://localhost:8083",
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
} as const;
