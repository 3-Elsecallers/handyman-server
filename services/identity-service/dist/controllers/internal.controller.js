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
exports.searchUsers = exports.batchGetUsers = exports.validateUser = exports.getNotificationPrefs = exports.getUserById = void 0;
const userService = __importStar(require("../services/userService"));
const notificationPrefsService = __importStar(require("../services/notificationPrefsService"));
const prisma_1 = require("../db/prisma");
const getUserById = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.params.id);
        res.json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserById = getUserById;
const getNotificationPrefs = async (req, res, next) => {
    try {
        const prefs = await notificationPrefsService.getPreferences(req.params.id);
        res.json({ success: true, data: prefs });
    }
    catch (error) {
        next(error);
    }
};
exports.getNotificationPrefs = getNotificationPrefs;
const validateUser = async (req, res, next) => {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds)) {
            return res.status(400).json({ success: false, message: "userIds array required" });
        }
        const users = await userService.getUsersByIds(userIds);
        res.json({ success: true, data: users });
    }
    catch (error) {
        next(error);
    }
};
exports.validateUser = validateUser;
const batchGetUsers = async (req, res, next) => {
    try {
        const ids = req.query.ids?.split(",") || [];
        const users = await userService.getUsersByIds(ids);
        res.json({ success: true, data: users });
    }
    catch (error) {
        next(error);
    }
};
exports.batchGetUsers = batchGetUsers;
const searchUsers = async (req, res, next) => {
    try {
        const query = req.query.query;
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
        if (!query || !query.trim()) {
            return res.json({ success: true, data: [] });
        }
        const users = await prisma_1.prisma.user.findMany({
            where: {
                OR: [
                    { firstName: { contains: query, mode: "insensitive" } },
                    { lastName: { contains: query, mode: "insensitive" } },
                    { email: { contains: query, mode: "insensitive" } },
                ],
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
            },
            take: Math.min(limit, 50),
        });
        res.json({ success: true, data: users });
    }
    catch (error) {
        next(error);
    }
};
exports.searchUsers = searchUsers;
//# sourceMappingURL=internal.controller.js.map