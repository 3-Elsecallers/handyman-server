import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ success: true, data: { service: "booking-service", status: "ok" } });
});

export default router;
