import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "8082", 10),
  serviceToken: process.env.SERVICE_TOKEN || "provider-service-internal-token",
  identityServiceUrl: process.env.IDENTITY_SERVICE_URL || "http://localhost:8081",
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: "provider-service",
    groupId: "provider-service-group",
  },
} as const;
