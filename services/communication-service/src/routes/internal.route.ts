import { Router } from "express";
import { serviceAuth } from "../middlewares/authenticate.middleware";
import * as internalController from "../controllers/internal.controller";

const router = Router();

router.use(serviceAuth);

router.post("/conversations/:bookingId", internalController.getConversationByBooking);
router.post("/notifications/send", internalController.sendNotification);

export default router;
