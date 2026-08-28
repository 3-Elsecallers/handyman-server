import { Router } from "express";
import * as bookingController from "../controllers/booking.controller";

const router = Router();

router.get("/bookings", bookingController.listProviderBookings);

export default router;
