import { Router } from "express";
import * as notificationPrefsController from "../controllers/notificationPrefs.controller";

const router = Router();

router.get("/preferences", notificationPrefsController.getPreferences);
router.put("/preferences", notificationPrefsController.updatePreferences);

export default router;
