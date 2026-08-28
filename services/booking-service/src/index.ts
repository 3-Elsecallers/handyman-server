import express from "express";
import cors from "cors";
import "dotenv/config";

import { config } from "./config/env";
import { authenticateFromHeaders, requireRole } from "./middlewares/authenticate.middleware";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { notFound } from "./middlewares/notFound.middleware";
import { startKafkaConsumers } from "./services/kafkaConsumer";

import healthRoutes from "./routes/health.route";
import bookingRoutes from "./routes/booking.route";
import customerRoutes from "./routes/customer.route";
import providerRoutes from "./routes/provider.route";
import internalRoutes from "./routes/internal.route";
import adminRoutes from "./routes/admin.route";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.use("/api/health", healthRoutes);

// Internal service-to-service routes (service token auth)
app.use("/internal", internalRoutes);

// Client-facing booking routes (customer or provider)
app.use("/bookings", authenticateFromHeaders, bookingRoutes);

// Customer list bookings
app.use("/customers", authenticateFromHeaders, requireRole("customer"), customerRoutes);

// Provider self-service bookings
app.use("/providers/me", authenticateFromHeaders, requireRole("provider"), providerRoutes);

// Admin routes (admin role)
app.use("/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

// Start Kafka consumers
startKafkaConsumers().catch((err) => {
  console.error("[Booking] Failed to start Kafka consumers:", err);
});

app.listen(config.port, () =>
  console.log(`[Booking] Service online on port ${config.port}`),
);
