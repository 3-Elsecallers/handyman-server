import express from "express";
import cors from "cors";
import "dotenv/config";
import paymentRoutes from "./routes/paymentRoutes";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { notFound } from "./middlewares/notFound.middleware";
import { authenticateFromHeaders } from "./middlewares/authenticate.middleware";
import { startConsumers } from "./consumers/kafkaConsumer";

const app = express();
const PORT = process.env.PORT || 8084;

app.use(cors());

// Webhook needs the raw body for signature verification; keep a copy before
// JSON parsing for /webhook only.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

app.get("/health", (_req, res) => res.json({ success: true, message: "payment-service healthy" }));

app.use(
  "/payments",
  (req, res, next) => {
    // /webhook is called by Paystack without user identity; it is verified
    // separately by signature in the controller. Everything else needs the
    // identity headers injected by the gateway.
    if (req.path === "/webhook") return next();
    return authenticateFromHeaders(req, res, next);
  },
  paymentRoutes,
);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`payment-service listening on port: ${PORT}`);
  await startConsumers().catch((err) => {
    console.error("[Payment] Failed to start kafka consumers:", err);
  });
});
