import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "8083", 10),
  serviceToken: process.env.SERVICE_TOKEN || "booking-service-internal-token",
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: "booking-service",
    groupId: "booking-service-group",
  },
} as const;
