import crypto from "crypto";
import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { hashPassword, verifyPassword } from "../utils/password";
import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/token";
import { publishEvent } from "../utils/kafka";
import type { RegisterInput, LoginInput } from "../validation/authValidation";

const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

const createEmailVerificationToken = () => {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000,
  );
  return { emailVerificationToken: token, emailVerificationExpires: expiresAt };
};

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
      ...createEmailVerificationToken(),
    },
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Identity] Email verification for ${user.email}: /auth/verify-email?token=${user.emailVerificationToken}`,
    );
  }

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

  if (!user.emailVerified && user.role !== "admin") {
    throw new AppError(403, "Please verify your email address before signing in");
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

export const verifyEmail = async (token: string) => {
  const user = await prisma.user.findUnique({
    where: { emailVerificationToken: token },
  });

  if (
    !user ||
    !user.emailVerificationExpires ||
    user.emailVerificationExpires < new Date()
  ) {
    throw new AppError(400, "Invalid or expired verification token");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return { message: "Email verified successfully" };
};

export const resendVerificationEmail = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (user.emailVerified) {
    throw new AppError(400, "Email already verified");
  }

  const { emailVerificationToken } = await prisma.user.update({
    where: { id: user.id },
    data: createEmailVerificationToken(),
  });

  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Identity] Email verification for ${user.email}: /auth/verify-email?token=${emailVerificationToken}`,
    );
  }

  return { message: "Verification email sent" };
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
