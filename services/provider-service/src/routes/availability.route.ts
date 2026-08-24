import { Router } from "express";
import * as availabilityController from "../controllers/availability.controller";

const router = Router();

router.get("/availability", availabilityController.getAvailability);
router.put("/availability", availabilityController.updateAvailability);
router.post("/blocked-slots", availabilityController.addBlockedSlot);
router.delete("/blocked-slots/:slotId", availabilityController.removeBlockedSlot);

export default router;
