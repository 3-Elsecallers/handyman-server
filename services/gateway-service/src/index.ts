import express from "express";
import cors from "cors";
import "dotenv/config";

import { gateway } from "./middlewares/gateway.middleware";
import { errorHandler } from "./middlewares/errorHandler.middleware";
import { notFound } from "./middlewares/notFound.middleware";
import { validateRequest } from "./middlewares/validateRequest.middleware";
import healthRoutes from "./routes/health.route";

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(validateRequest);

app.get("/", (_req, res) =>
  res.status(200).json({
    success: true,
    data: {
      service: "api-gateway",
      status: "ok",
      health: "/api/health",
    },
  }),
);

app.use("/api/health", healthRoutes);

app.use(gateway);

app.use(notFound);
app.use(errorHandler);

app.listen(PORT, () => console.log(`API Gateway online on port ${PORT}`));
