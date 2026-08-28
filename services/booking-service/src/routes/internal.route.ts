import { Router } from "express";
import * as internalController from "../controllers/internal.controller";
import { serviceAuth } from "../middlewares/authenticate.middleware";

const router = Router();

router.use(serviceAuth);

router.get("/bookings/:id", internalController.getBookingById);
router.get("/bookings/customer/:id", internalController.getBookingsByCustomer);
router.get("/bookings/provider/:id", internalController.getBookingsByProvider);

export default router;
