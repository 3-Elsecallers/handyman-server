import { Router } from "express";
import * as messageController from "../controllers/message.controller";

const router = Router({ mergeParams: true });

router.get("/", messageController.getMessageHistory);
router.post("/", messageController.sendMessage);
router.post("/presign", messageController.presignUpload);
router.post("/read", messageController.markAsRead);
router.get("/unread", messageController.getUnreadCount);

export default router;
