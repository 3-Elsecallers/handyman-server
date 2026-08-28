import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { authenticateFromHeaders, requireRole } from "../middlewares/authenticate.middleware";

const router = Router();

router.use(authenticateFromHeaders);
router.use(requireRole("admin"));

router.get("/bookings", adminController.listAllBookings);
router.get("/bookings/:id", adminController.getBookingDetail);
router.put("/bookings/:id/resolve", adminController.resolveDispute);

router.get("/promos", adminController.listPromos);
router.post("/promos", adminController.createPromo);
router.put("/promos/:id", adminController.updatePromo);
router.delete("/promos/:id", adminController.deletePromo);

export default router;
