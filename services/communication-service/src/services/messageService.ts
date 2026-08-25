import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import { generateDownloadUrl } from "../utils/s3";

export const sendMessage = async (
  conversationId: string,
  senderId: string,
  content: string,
  type: string = "text",
  imageUrl?: string,
) => {
  const message = await prisma.message.create({
    data: { conversationId, senderId, content, type, imageUrl },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: message.createdAt },
  });

  await publishEvent("message.sent", message.id, {
    bookingId: conversationId,
    messageId: message.id,
    senderId,
    type,
  });

  return message;
};

export const getMessageHistory = async (
  conversationId: string,
  limit: number = 50,
  cursor?: string,
) => {
  const where: Record<string, unknown> = { conversationId };
  if (cursor) {
    where.createdAt = { lt: new Date(cursor) };
  }

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
  });

  const hasMore = messages.length > limit;
  const data = hasMore ? messages.slice(0, limit) : messages;

  // Resolve image URLs
  const resolved = await Promise.all(
    data.map(async (msg) => {
      if (msg.imageUrl) {
        const url = await generateDownloadUrl(msg.imageUrl);
        return { ...msg, imageUrl: url };
      }
      return msg;
    }),
  );

  return {
    messages: resolved,
    nextCursor: hasMore ? data[data.length - 1].createdAt.toISOString() : null,
  };
};

export const markMessagesAsRead = async (
  conversationId: string,
  userId: string,
) => {
  await prisma.message.updateMany({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
    data: { readAt: new Date() },
  });
};

export const getUnreadCount = async (
  conversationId: string,
  userId: string,
) => {
  const count = await prisma.message.count({
    where: {
      conversationId,
      senderId: { not: userId },
      readAt: null,
    },
  });
  return count;
};
