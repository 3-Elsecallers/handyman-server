import { Router } from "express";
import * as conversationController from "../controllers/conversation.controller";

const router = Router();

router.get("/", conversationController.listConversations);
router.get("/:id", conversationController.getConversation);

export default router;
