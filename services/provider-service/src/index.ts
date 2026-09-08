import express from "express";
import cors from "cors";
import "dotenv/config";

import { config } from "./config/env";
import { authenticateFromHeaders, requireRole } from "./middlewares/authenticate.middleware";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { notFound } from "./middlewares/notFound.middleware";
import { startKafkaConsumers } from "./services/kafkaConsumer";
import { getPublicProfile } from "./controllers/provider.controller";
import { recalculateAllProviders } from "./services/qualityService";

import healthRoutes from "./routes/health.route";
import providerRoutes from "./routes/provider.route";
import availabilityRoutes from "./routes/availability.route";
import catalogRoutes from "./routes/catalog.route";
import searchRoutes from "./routes/search.route";
import matchingRoutes from "./routes/matching.route";
import reviewRoutes from "./routes/review.route";
import internalRoutes from "./routes/internal.route";
import adminRoutes from "./routes/admin.route";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.use("/api/health", healthRoutes);

// Public routes (no auth)
app.use("/services", catalogRoutes);
app.use("/search", searchRoutes);

// Review routes (mixed auth - public reads, authenticated writes)
app.use("/", reviewRoutes);

// Internal service-to-service routes
app.use("/internal", internalRoutes);

// Provider self-service routes (authenticated, provider role)
// Mounted at /providers/me — must come BEFORE /providers/:id to avoid param catch-all
app.use("/providers/me", authenticateFromHeaders, requireRole("provider"), providerRoutes);
app.use("/providers/me", authenticateFromHeaders, requireRole("provider"), availabilityRoutes);

// Public provider profile (after /providers/me so "me" isn't caught as :id)
app.get("/providers/:id", getPublicProfile);

// Matching routes (authenticated, provider role)
app.use("/matching", authenticateFromHeaders, requireRole("provider"), matchingRoutes);

// Admin routes (admin role)
app.use("/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

// Start Kafka consumers
startKafkaConsumers().catch((err) => {
  console.error("[Provider] Failed to start Kafka consumers:", err);
});

// Weekly quality recalculation (every Sunday 02:00 UTC)
const WEEKLY_MS = 7 * 24 * 60 * 60 * 1000;
const scheduleWeeklyRecalc = () => {
  const now = new Date();
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + ((7 - now.getUTCDay()) % 7 || 7));
  nextSunday.setUTCHours(2, 0, 0, 0);
  let delay = nextSunday.getTime() - now.getTime();
  if (delay < 0) delay += WEEKLY_MS;

  setTimeout(async () => {
    try {
      const result = await recalculateAllProviders();
      console.log(`[Quality] Weekly recalculation complete: ${result.recalculated} providers`);
    } catch (err) {
      console.error("[Quality] Weekly recalculation failed:", err);
    }
    scheduleWeeklyRecalc();
  }, delay);
};
scheduleWeeklyRecalc();

app.listen(config.port, () =>
  console.log(`[Provider] Service online on port ${config.port}`),
);
