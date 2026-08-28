"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serviceAuth = exports.requireRole = exports.authenticateFromHeaders = void 0;
const env_1 = require("../config/env");
const authenticateFromHeaders = (req, res, next) => {
    const userId = req.headers["x-user-id"];
    if (!userId) {
        return res
            .status(401)
            .json({ success: false, message: "Missing user identity headers" });
    }
    req.user = {
        id: userId,
        name: req.headers["x-user-name"] || "",
        email: req.headers["x-user-email"],
        phone: req.headers["x-user-phone"],
        role: (req.headers["x-user-role"] || "customer"),
    };
    next();
};
exports.authenticateFromHeaders = authenticateFromHeaders;
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res
                .status(403)
                .json({ success: false, message: "Insufficient permissions" });
        }
        next();
    };
};
exports.requireRole = requireRole;
const serviceAuth = (req, res, next) => {
    const token = req.headers["x-service-token"];
    if (token !== env_1.config.internalServiceToken) {
        return res
            .status(403)
            .json({ success: false, message: "Invalid service token" });
    }
    next();
};
exports.serviceAuth = serviceAuth;
//# sourceMappingURL=authenticate.middleware.js.map