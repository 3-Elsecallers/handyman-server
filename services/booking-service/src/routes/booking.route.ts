import { Router } from "express";
import * as bookingController from "../controllers/booking.controller";
import { requireRole } from "../middlewares/authenticate.middleware";

const router = Router();

router.post("/", requireRole("customer"), bookingController.createBooking);
router.post("/estimate", requireRole("customer"), bookingController.estimateBooking);
router.get("/:id", bookingController.getBooking);
router.get("/:id/provider", requireRole("customer"), bookingController.getBookingProvider);
router.put("/:id/cancel", bookingController.cancelBooking);
router.post("/:id/dispute", requireRole("customer"), bookingController.disputeBooking);
router.get("/:id/timeline", bookingController.getTimeline);

router.put("/:id/confirm", requireRole("provider"), bookingController.confirmBooking);
router.put("/:id/decline", requireRole("provider"), bookingController.declineBooking);
router.put("/:id/start", requireRole("provider"), bookingController.startBooking);
router.put("/:id/complete", requireRole("provider"), bookingController.completeBooking);

export default router;
