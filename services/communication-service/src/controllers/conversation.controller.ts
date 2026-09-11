import { Request, Response } from "express";
import * as conversationService from "../services/conversationService";

export const listConversations = async (req: Request, res: Response) => {
  const conversations = await conversationService.listConversationsForUser(
    req.user!.id,
  );
  res.json({ success: true, data: conversations });
};

export const createConversation = async (req: Request, res: Response) => {
  const { bookingId, customerId, providerId } = req.body;
  if (!bookingId || !customerId || !providerId) {
    return res.status(400).json({
      success: false,
      message: "bookingId, customerId and providerId are required",
    });
  }
  const conversation = await conversationService.getOrCreateConversation(
    bookingId,
    customerId,
    providerId,
  );
  res.status(201).json({ success: true, data: conversation });
};

export const getConversation = async (req: Request, res: Response) => {
  const conversation = await conversationService.getConversationById(
    req.params.id as string,
  );
  res.json({ success: true, data: conversation });
};
