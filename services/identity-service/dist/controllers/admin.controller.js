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
exports.getAuditLog = exports.deleteUser = exports.updateUserStatus = exports.getUserDetail = exports.listUsers = void 0;
const adminService = __importStar(require("../services/adminService"));
const listUsers = async (req, res, next) => {
    try {
        const result = await adminService.listUsers({
            page: req.query.page ? parseInt(req.query.page) : undefined,
            limit: req.query.limit ? parseInt(req.query.limit) : undefined,
            search: req.query.search,
            role: req.query.role,
            status: req.query.status,
        });
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.listUsers = listUsers;
const getUserDetail = async (req, res, next) => {
    try {
        const user = await adminService.getUserDetail(req.params.id);
        res.json({ success: true, data: user });
    }
    catch (error) {
        next(error);
    }
};
exports.getUserDetail = getUserDetail;
const updateUserStatus = async (req, res, next) => {
    try {
        const { action } = req.body;
        if (action !== "suspend" && action !== "activate") {
            return res.status(400).json({
                success: false,
                message: "Action must be 'suspend' or 'activate'",
            });
        }
        const result = await adminService.updateUserStatus(req.params.id, action, req.user.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.updateUserStatus = updateUserStatus;
const deleteUser = async (req, res, next) => {
    try {
        const result = await adminService.deleteUser(req.params.id, req.user.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteUser = deleteUser;
const getAuditLog = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const result = await adminService.getAuditLog(page, limit);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
};
exports.getAuditLog = getAuditLog;
//# sourceMappingURL=admin.controller.js.map