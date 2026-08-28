"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.logoutAll = exports.resendVerification = exports.verifyEmail = exports.logout = exports.refresh = exports.login = exports.register = void 0;
const authService = __importStar(require("../services/authService"));
const authValidation_1 = require("../validation/authValidation");
const register = async (req, res, next) => {
    try {
        const input = authValidation_1.registerSchema.parse(req.body);
        const tokens = await authService.register(input);
        res.status(201).json({ success: true, data: tokens });
    }
    catch (error) {
        next(error);
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const input = authValidation_1.loginSchema.parse(req.body);
        const tokens = await authService.login(input);
        res.json({ success: true, data: tokens });
    }
    catch (error) {
        next(error);
    }
};
exports.login = login;
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ success: false, message: "Refresh token required" });
        }
        const tokens = await authService.refreshTokens(refreshToken);
        res.json({ success: true, data: tokens });
    }
    catch (error) {
        next(error);
    }
};
exports.refresh = refresh;
const logout = async (req, res, next) => {
    try {
        await authService.logout(req.user.id, req.body.refreshToken);
        res.json({ success: true, data: { message: "Logged out" } });
    }
    catch (error) {
        next(error);
    }
};
exports.logout = logout;
const verifyEmail = async (req, res, next) => {
    try {
        const input = authValidation_1.verifyEmailSchema.parse(req.body);
        const result = await authService.verifyEmail(input.token);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.verifyEmail = verifyEmail;
const resendVerification = async (req, res, next) => {
    try {
        const result = await authService.resendVerificationEmail(req.user.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.resendVerification = resendVerification;
const logoutAll = async (req, res, next) => {
    try {
        await authService.logoutAll(req.user.id);
        res.json({ success: true, data: { message: "All sessions invalidated" } });
    }
    catch (error) {
        next(error);
    }
};
exports.logoutAll = logoutAll;
//# sourceMappingURL=auth.controller.js.map