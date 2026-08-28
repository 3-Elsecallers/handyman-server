"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.sendError = exports.AppError = void 0;
const zod_1 = require("zod");
class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = "AppError";
    }
}
exports.AppError = AppError;
const sendError = (res, status, message) => {
    return res.status(status).json({ success: false, message });
};
exports.sendError = sendError;
const errorHandler = (err, _req, res, _next) => {
    if (err instanceof zod_1.ZodError) {
        return (0, exports.sendError)(res, 400, err.issues[0]?.message || "Invalid request");
    }
    const { statusCode, message } = (err ?? {});
    if (statusCode) {
        return (0, exports.sendError)(res, statusCode, message || "Identity service error");
    }
    console.error("[Identity] Unhandled error:", err);
    return (0, exports.sendError)(res, 500, "Internal server error");
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.middleware.js.map