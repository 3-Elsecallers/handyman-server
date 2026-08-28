"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAccessToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const generateAccessToken = (payload) => jsonwebtoken_1.default.sign(payload, env_1.config.accessTokenSecret, {
    expiresIn: env_1.config.accessTokenExpiry,
});
exports.generateAccessToken = generateAccessToken;
const generateRefreshToken = () => {
    const token = crypto_1.default.randomBytes(40).toString("hex");
    const expiresAt = new Date(Date.now() + env_1.config.refreshTokenExpiryDays * 24 * 60 * 60 * 1000);
    return { token, expiresAt };
};
exports.generateRefreshToken = generateRefreshToken;
const verifyAccessToken = (token) => {
    try {
        return jsonwebtoken_1.default.verify(token, env_1.config.accessTokenSecret);
    }
    catch {
        return null;
    }
};
exports.verifyAccessToken = verifyAccessToken;
//# sourceMappingURL=token.js.map