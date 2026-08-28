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
exports.uploadAvatar = exports.updateProfile = exports.getProfile = void 0;
const userService = __importStar(require("../services/userService"));
const profileValidation_1 = require("../validation/profileValidation");
const getProfile = async (req, res, next) => {
    try {
        const profile = await userService.getProfile(req.user.id);
        res.json({ success: true, data: profile });
    }
    catch (error) {
        next(error);
    }
};
exports.getProfile = getProfile;
const updateProfile = async (req, res, next) => {
    try {
        const input = profileValidation_1.updateProfileSchema.parse(req.body);
        const profile = await userService.updateProfile(req.user.id, input);
        res.json({ success: true, data: profile });
    }
    catch (error) {
        next(error);
    }
};
exports.updateProfile = updateProfile;
const uploadAvatar = async (req, res, next) => {
    try {
        const { avatarUrl } = req.body;
        if (!avatarUrl) {
            return res.status(400).json({ success: false, message: "avatarUrl required" });
        }
        const result = await userService.uploadAvatar(req.user.id, avatarUrl);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.uploadAvatar = uploadAvatar;
//# sourceMappingURL=profile.controller.js.map