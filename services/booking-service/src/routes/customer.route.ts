import { Router } from "express";
import * as bookingController from "../controllers/booking.controller";

const router = Router();

router.get("/bookings", bookingController.listCustomerBookings);
router.post("/bookings/:id/reassign", bookingController.reassignBooking);

export default router;
