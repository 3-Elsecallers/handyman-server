import { Router } from "express";
import * as internalController from "../controllers/internal.controller";
import { serviceAuth } from "../middlewares/authenticate.middleware";

const router = Router();

router.use(serviceAuth);

router.post("/users/validate", internalController.validateUser);
router.get("/users/batch", internalController.batchGetUsers);
router.get("/users/search", internalController.searchUsers);
router.get("/users/:id", internalController.getUserById);
router.get("/users/:id/notification-prefs", internalController.getNotificationPrefs);

export default router;
