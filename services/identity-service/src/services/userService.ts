import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import type { UpdateProfileInput } from "../validation/profileValidation";

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  const { passwordHash, ...profile } = user;
  return profile;
};

export const updateProfile = async (
  userId: string,
  input: UpdateProfileInput,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: input,
  });

  await publishEvent("identity.user.updated", userId, {
    userId,
    fields: Object.keys(input),
  });

  const { passwordHash, ...profile } = updated;
  return profile;
};

export const uploadAvatar = async (userId: string, avatarUrl: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });

  await publishEvent("identity.user.updated", userId, {
    userId,
    fields: ["avatarUrl"],
  });

  return { avatarUrl: updated.avatarUrl };
};

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt,
  };
};

export const getUsersByIds = async (ids: string[]) => {
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      createdAt: true,
    },
  });
  return users;
};
