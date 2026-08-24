import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";

export const listUsers = async (query: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}) => {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query.role) {
    where.role = query.role;
  }

  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: "insensitive" } },
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const getUserDetail = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      role: true,
      emailVerified: true,
      phoneVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw new AppError(404, "User not found");
  return user;
};

export const updateUserStatus = async (
  userId: string,
  action: "suspend" | "activate",
  adminId: string,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  if (action === "suspend") {
    await publishEvent("identity.user.suspended", userId, {
      userId,
      reason: "Suspended by admin",
      adminId,
    });
  }

  return { userId, action, updatedAt: new Date() };
};
