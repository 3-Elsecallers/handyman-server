import { Router } from "express";
import {
  requireRole,
  serviceAuth,
} from "../middlewares/authenticate.middleware";
import {
  addTip,
  adminGetPayment,
  adminGetRefund,
  adminListPayments,
  adminListPayouts,
  adminListRefunds,
  adminRecordPayout,
  getPayment,
  initializePayment,
  internalCreatePayment,
  internalGetByBooking,
  internalGetPayment,
  internalRecordPayout,
  internalVerify,
  listCustomerPayments,
  manualVerify,
  providerEarnings,
  providerLedger,
  providerPayouts,
  refundPayment,
  verifyPayment,
  webhook,
} from "../controllers/paymentController";

const router = Router();

// Customer-facing
router.post("/initialize", initializePayment);
router.get("/customer/payments", listCustomerPayments);
router.get("/:id", getPayment);
router.post("/:id/verify", verifyPayment);
router.post("/:id/tip", addTip);
router.post("/:id/refund", refundPayment);

// Provider-facing
router.get("/provider/earnings", providerEarnings);
router.get("/provider/payouts", providerPayouts);
router.get("/provider/ledger", providerLedger);

// Admin
router.get("/admin/payments", requireRole("admin"), adminListPayments);
router.get("/admin/payments/:id", requireRole("admin"), adminGetPayment);
router.get("/admin/refunds", requireRole("admin"), adminListRefunds);
router.get("/admin/refunds/:id", requireRole("admin"), adminGetRefund);
router.get("/admin/payouts", requireRole("admin"), adminListPayouts);
router.post("/admin/payouts", requireRole("admin"), adminRecordPayout);

// Internal (service-to-service)
router.post("/internal/payments", serviceAuth, internalCreatePayment);
router.get("/internal/payments/:id", serviceAuth, internalGetPayment);
router.get("/internal/bookings/:bookingId", serviceAuth, internalGetByBooking);
router.post("/internal/payments/:id/verify", serviceAuth, internalVerify);
router.post("/internal/payouts", serviceAuth, internalRecordPayout);

// Paystack webhook (verified by signature in the controller)
router.post("/webhook", webhook);

// Manual verify (dev/admin convenience) — admin only
router.post("/admin/payments/:id/verify", requireRole("admin"), manualVerify);

export default router;
