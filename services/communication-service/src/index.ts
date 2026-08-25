import express from "express";
import cors from "cors";
import http from "http";
import "dotenv/config";

import { config } from "./config/env";
import { authenticateFromHeaders } from "./middlewares/authenticate.middleware";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { notFound } from "./middlewares/notFound.middleware";
import { initWebSocket } from "./websocket/server";
import { startKafkaConsumers } from "./services/kafkaConsumer";

import healthRoutes from "./routes/health.route";
import internalRoutes from "./routes/internal.route";
import conversationRoutes from "./routes/conversation.route";
import messageRoutes from "./routes/message.route";
import notificationRoutes from "./routes/notification.route";
import deviceTokenRoutes from "./routes/deviceToken.route";

const app = express();

app.use(cors());
app.use(express.json());

// Health check
app.use("/api/health", healthRoutes);

// Internal service-to-service routes (service token auth)
app.use("/internal", internalRoutes);

// Protected client-facing routes (gateway forwards x-user-* headers)
app.use("/conversations", authenticateFromHeaders, conversationRoutes);
app.use("/conversations/:id/messages", authenticateFromHeaders, messageRoutes);
app.use("/notifications", authenticateFromHeaders, notificationRoutes);
app.use("/notifications/device-token", authenticateFromHeaders, deviceTokenRoutes);

app.use(notFound);
app.use(errorHandler);

// Create HTTP server + WebSocket
const server = http.createServer(app);
initWebSocket(server);

// Start Kafka consumers
startKafkaConsumers().catch((err) => {
  console.error("[Communication] Failed to start Kafka consumers:", err);
});

server.listen(config.port, () =>
  console.log(`[Communication] Service online on port ${config.port}`),
);
