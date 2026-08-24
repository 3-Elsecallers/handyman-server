import express from "express";
import cors from "cors";
import "dotenv/config";

import { config } from "./config/env";
import { authenticateFromHeaders } from "./middlewares/authenticate.middleware";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { notFound } from "./middlewares/notFound.middleware";

import healthRoutes from "./routes/health.route";
import authRoutes from "./routes/auth.route";
import profileRoutes from "./routes/profile.route";
import addressRoutes from "./routes/address.route";
import favoriteRoutes from "./routes/favorite.route";
import notificationPrefsRoutes from "./routes/notificationPrefs.route";
import internalRoutes from "./routes/internal.route";
import adminRoutes from "./routes/admin.route";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.use("/api/health", healthRoutes);

// Public auth routes (no auth required)
app.use("/auth", authRoutes);

// Internal service-to-service routes (service token auth)
app.use("/internal", internalRoutes);

// Protected customer routes (gateway forwards x-user-* headers)
app.use("/customers", authenticateFromHeaders, profileRoutes);
app.use("/customers/addresses", authenticateFromHeaders, addressRoutes);
app.use("/customers/favorites", authenticateFromHeaders, favoriteRoutes);
app.use("/customers/notifications", authenticateFromHeaders, notificationPrefsRoutes);

// Admin routes (gateway forwards headers + checks admin role)
app.use("/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () =>
  console.log(`[Identity] Service online on port ${config.port}`),
);
