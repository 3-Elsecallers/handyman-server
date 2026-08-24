import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT || "8081", 10),
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET || "dev-access-secret-change-me",
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || "dev-refresh-secret-change-me",
  accessTokenExpiry: "15m",
  refreshTokenExpiryDays: 7,
  serviceToken: process.env.SERVICE_TOKEN || "identity-service-internal-token",
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    clientId: "identity-service",
  },
} as const;
