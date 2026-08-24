import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/token";
import { publishEvent } from "../utils/kafka";
import type { RegisterInput, LoginInput } from "../validation/authValidation";

export const register = async (input: RegisterInput) => {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      role: input.role,
    },
  });

  await publishEvent("identity.user.registered", user.id, {
    userId: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  });

  return generateTokenPair(user.id, user.email, user.firstName, user.role);
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (!user || !user.passwordHash) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  return generateTokenPair(user.id, user.email, user.firstName, user.role);
};

export const refreshTokens = async (refreshToken: string) => {
  const stored = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError(401, "Invalid or expired refresh token");
  }

  await prisma.refreshToken.delete({ where: { id: stored.id } });

  return generateTokenPair(
    stored.user.id,
    stored.user.email,
    stored.user.firstName,
    stored.user.role,
  );
};

export const logout = async (userId: string, refreshToken?: string) => {
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { userId, token: refreshToken },
    });
  }
};

export const logoutAll = async (userId: string) => {
  await prisma.refreshToken.deleteMany({ where: { userId } });
};

const generateTokenPair = async (
  userId: string,
  email: string,
  name: string,
  role: string,
) => {
  const accessToken = generateAccessToken({ id: userId, name, email, role });
  const { token: refreshToken, expiresAt } = generateRefreshToken();

  await prisma.refreshToken.create({
    data: { userId, token: refreshToken, expiresAt },
  });

  return { accessToken, refreshToken };
};
