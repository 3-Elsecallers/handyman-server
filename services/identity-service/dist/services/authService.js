"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resendVerificationEmail = exports.verifyEmail = exports.logoutAll = exports.logout = exports.refreshTokens = exports.login = exports.register = void 0;
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../db/prisma");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const password_1 = require("../utils/password");
const token_1 = require("../utils/token");
const kafka_1 = require("../utils/kafka");
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;
const createEmailVerificationToken = () => {
    const token = crypto_1.default.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);
    return { emailVerificationToken: token, emailVerificationExpires: expiresAt };
};
const register = async (input) => {
    const existing = await prisma_1.prisma.user.findUnique({
        where: { email: input.email },
    });
    if (existing) {
        throw new errorHandler_middleware_1.AppError(409, "Email already registered");
    }
    const passwordHash = await (0, password_1.hashPassword)(input.password);
    const user = await prisma_1.prisma.user.create({
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
        console.log(`[Identity] Email verification for ${user.email}: /auth/verify-email?token=${user.emailVerificationToken}`);
    }
    await (0, kafka_1.publishEvent)("identity.user.registered", user.id, {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
    });
    return generateTokenPair(user.id, user.email, `${user.firstName} ${user.lastName}`, user.role);
};
exports.register = register;
const login = async (input) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: input.email },
    });
    if (!user || !user.passwordHash) {
        throw new errorHandler_middleware_1.AppError(401, "Invalid email or password");
    }
    const valid = await (0, password_1.verifyPassword)(user.passwordHash, input.password);
    if (!valid) {
        throw new errorHandler_middleware_1.AppError(401, "Invalid email or password");
    }
    if (!user.emailVerified && user.role !== "admin") {
        throw new errorHandler_middleware_1.AppError(403, "Please verify your email address before signing in");
    }
    return generateTokenPair(user.id, user.email, `${user.firstName} ${user.lastName}`, user.role);
};
exports.login = login;
const refreshTokens = async (refreshToken) => {
    const stored = await prisma_1.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true },
    });
    if (!stored) {
        throw new errorHandler_middleware_1.AppError(401, "Invalid or expired refresh token");
    }
    if (stored.expiresAt < new Date()) {
        await prisma_1.prisma.refreshToken.delete({ where: { id: stored.id } });
        throw new errorHandler_middleware_1.AppError(401, "Invalid or expired refresh token");
    }
    const accessToken = (0, token_1.generateAccessToken)({
        id: stored.user.id,
        email: stored.user.email,
        name: `${stored.user.firstName} ${stored.user.lastName}`,
        role: stored.user.role,
    });
    return { accessToken };
};
exports.refreshTokens = refreshTokens;
const logout = async (userId, refreshToken) => {
    if (refreshToken) {
        await prisma_1.prisma.refreshToken.deleteMany({
            where: { userId, token: refreshToken },
        });
    }
};
exports.logout = logout;
const logoutAll = async (userId) => {
    await prisma_1.prisma.refreshToken.deleteMany({ where: { userId } });
};
exports.logoutAll = logoutAll;
const verifyEmail = async (token) => {
    const user = await prisma_1.prisma.user.findUnique({
        where: { emailVerificationToken: token },
    });
    if (!user ||
        !user.emailVerificationExpires ||
        user.emailVerificationExpires < new Date()) {
        throw new errorHandler_middleware_1.AppError(400, "Invalid or expired verification token");
    }
    await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: {
            emailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null,
        },
    });
    return { message: "Email verified successfully" };
};
exports.verifyEmail = verifyEmail;
const resendVerificationEmail = async (userId) => {
    const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
        throw new errorHandler_middleware_1.AppError(404, "User not found");
    }
    if (user.emailVerified) {
        throw new errorHandler_middleware_1.AppError(400, "Email already verified");
    }
    const { emailVerificationToken } = await prisma_1.prisma.user.update({
        where: { id: user.id },
        data: createEmailVerificationToken(),
    });
    if (process.env.NODE_ENV !== "production") {
        console.log(`[Identity] Email verification for ${user.email}: /auth/verify-email?token=${emailVerificationToken}`);
    }
    return { message: "Verification email sent" };
};
exports.resendVerificationEmail = resendVerificationEmail;
const generateTokenPair = async (userId, email, name, role) => {
    const accessToken = (0, token_1.generateAccessToken)({ id: userId, name, email, role });
    const { token: refreshToken, expiresAt } = (0, token_1.generateRefreshToken)();
    await prisma_1.prisma.refreshToken.create({
        data: { userId, token: refreshToken, expiresAt },
    });
    return { accessToken, refreshToken };
};
//# sourceMappingURL=authService.js.map