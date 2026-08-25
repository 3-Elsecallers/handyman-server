import { Router } from "express";
import * as deviceTokenController from "../controllers/deviceToken.controller";

const router = Router();

router.post("/", deviceTokenController.registerDeviceToken);
router.delete("/", deviceTokenController.removeDeviceToken);

export default router;
