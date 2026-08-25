import { Request, Response } from "express";
import * as conversationService from "../services/conversationService";

export const listConversations = async (req: Request, res: Response) => {
  const conversations = await conversationService.listConversationsForUser(
    req.user!.id,
  );
  res.json({ success: true, data: conversations });
};

export const getConversation = async (req: Request, res: Response) => {
  const conversation = await conversationService.getConversationById(
    req.params.id as string,
  );
  res.json({ success: true, data: conversation });
};
