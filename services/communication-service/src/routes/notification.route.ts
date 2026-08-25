import { Router } from "express";
import * as notificationController from "../controllers/notification.controller";

const router = Router();

router.get("/", notificationController.listNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.put("/read-all", notificationController.markAllAsRead);
router.put("/:id/read", notificationController.markAsRead);

export default router;
