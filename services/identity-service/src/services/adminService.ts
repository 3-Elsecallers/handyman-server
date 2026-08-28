import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";

export const listUsers = async (query: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}) => {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (query.role) {
    where.role = query.role;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.search) {
    where.OR = [
      { email: { contains: query.search, mode: "insensitive" } },
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { phone: { contains: query.search, mode: "insensitive" } },
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
        status: true,
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
      status: true,
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

  const newStatus = action === "suspend" ? "suspended" : "active";

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: newStatus as "active" | "suspended" },
    select: { id: true, status: true, updatedAt: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: action === "suspend" ? "user_suspended" : "user_activated",
      targetType: "user",
      targetId: userId,
    },
  });

  if (action === "suspend") {
    await publishEvent("identity.user.suspended", userId, {
      userId,
      reason: "Suspended by admin",
      adminId,
    });
  }

  return updated;
};

export const deleteUser = async (userId: string, adminId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "User not found");

  if (user.role === "admin") {
    throw new AppError(400, "Admin users cannot be deleted");
  }

  await prisma.user.delete({ where: { id: userId } });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "user_deleted",
      targetType: "user",
      targetId: userId,
      metadata: { email: user.email, role: user.role },
    },
  });

  await publishEvent("identity.user.deleted", userId, {
    userId,
    adminId,
  });

  return { userId, deletedAt: new Date() };
};

export const getAuditLog = async (page = 1, limit = 50) => {
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count(),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};
