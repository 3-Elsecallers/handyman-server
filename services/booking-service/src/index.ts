import express from "express";
import cors from "cors";
import "dotenv/config";

import { config } from "./config/env";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ success: true, data: { service: "booking-service", status: "ok" } });
});

app.listen(config.port, () =>
  console.log(`[Booking] Service online on port ${config.port}`),
);
