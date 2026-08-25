import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";

export const getOrCreateConversation = async (
  bookingId: string,
  customerId: string,
  providerId: string,
) => {
  let conversation = await prisma.conversation.findUnique({
    where: { bookingId },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { bookingId, customerId, providerId },
    });
  }

  return conversation;
};

export const getConversationById = async (conversationId: string) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!conversation) throw new AppError(404, "Conversation not found");
  return conversation;
};

export const listConversationsForUser = async (userId: string) => {
  return prisma.conversation.findMany({
    where: {
      OR: [{ customerId: userId }, { providerId: userId }],
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });
};

export const assertUserInConversation = async (
  conversationId: string,
  userId: string,
) => {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });
  if (!conversation) throw new AppError(404, "Conversation not found");
  if (conversation.customerId !== userId && conversation.providerId !== userId) {
    throw new AppError(403, "Not a participant in this conversation");
  }
  return conversation;
};
