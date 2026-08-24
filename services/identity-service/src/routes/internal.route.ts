import { Router } from "express";
import * as internalController from "../controllers/internal.controller";
import { serviceAuth } from "../middlewares/authenticate.middleware";

const router = Router();

router.use(serviceAuth);

router.get("/users/:id", internalController.getUserById);
router.get("/users/:id/notification-prefs", internalController.getNotificationPrefs);
router.post("/users/validate", internalController.validateUser);
router.get("/users/batch", internalController.batchGetUsers);

export default router;
