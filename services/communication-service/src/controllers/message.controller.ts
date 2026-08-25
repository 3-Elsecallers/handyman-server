import { Request, Response } from "express";
import * as messageService from "../services/messageService";
import * as conversationService from "../services/conversationService";
import {
  buildS3Key,
  generateUploadUrl,
  extFromMime,
  validateFileType,
  validateFileSize,
} from "../utils/s3";

export const getMessageHistory = async (req: Request, res: Response) => {
  const conversationId = req.params.id as string;
  await conversationService.assertUserInConversation(conversationId, req.user!.id);

  const limit = parseInt(req.query.limit as string) || 50;
  const cursor = req.query.cursor as string | undefined;
  const data = await messageService.getMessageHistory(conversationId, limit, cursor);
  res.json({ success: true, data });
};

export const sendMessage = async (req: Request, res: Response) => {
  const conversationId = req.params.id as string;
  await conversationService.assertUserInConversation(conversationId, req.user!.id);

  const { content, type, imageUrl } = req.body;
  const message = await messageService.sendMessage(
    conversationId,
    req.user!.id,
    content,
    type,
    imageUrl,
  );
  res.status(201).json({ success: true, data: message });
};

export const markAsRead = async (req: Request, res: Response) => {
  const conversationId = req.params.id as string;
  await conversationService.assertUserInConversation(conversationId, req.user!.id);
  await messageService.markMessagesAsRead(conversationId, req.user!.id);
  res.json({ success: true, data: { marked: true } });
};

export const getUnreadCount = async (req: Request, res: Response) => {
  const conversationId = req.params.id as string;
  await conversationService.assertUserInConversation(conversationId, req.user!.id);
  const count = await messageService.getUnreadCount(conversationId, req.user!.id);
  res.json({ success: true, data: { count } });
};

export const presignUpload = async (req: Request, res: Response) => {
  const conversationId = req.params.id as string;
  await conversationService.assertUserInConversation(conversationId, req.user!.id);

  const { filename, contentType, size } = req.body;
  validateFileType(contentType);
  validateFileSize(size);

  const ext = extFromMime(contentType);
  const key = buildS3Key(conversationId, ext);
  const uploadUrl = await generateUploadUrl(key, contentType);

  res.json({ success: true, data: { uploadUrl, key } });
};
