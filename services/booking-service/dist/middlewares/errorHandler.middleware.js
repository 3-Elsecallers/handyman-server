"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.sendError = exports.AppError = void 0;
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
    if (err instanceof AppError) {
        return (0, exports.sendError)(res, err.statusCode, err.message);
    }
    if (err.statusCode) {
        return (0, exports.sendError)(res, err.statusCode, err.message || "Booking service error");
    }
    console.error("[Booking] Unhandled error:", err);
    return (0, exports.sendError)(res, 500, "Internal server error");
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.middleware.js.map