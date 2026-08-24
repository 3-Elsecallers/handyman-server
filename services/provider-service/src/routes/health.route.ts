import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      service: "provider-service",
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
