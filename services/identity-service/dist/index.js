"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
require("dotenv/config");
const env_1 = require("./config/env");
const authenticate_middleware_1 = require("./middlewares/authenticate.middleware");
const errorHandler_middleware_1 = require("./middlewares/errorHandler.middleware");
const notFound_middleware_1 = require("./middlewares/notFound.middleware");
const health_route_1 = __importDefault(require("./routes/health.route"));
const auth_route_1 = __importDefault(require("./routes/auth.route"));
const profile_route_1 = __importDefault(require("./routes/profile.route"));
const address_route_1 = __importDefault(require("./routes/address.route"));
const favorite_route_1 = __importDefault(require("./routes/favorite.route"));
const notificationPrefs_route_1 = __importDefault(require("./routes/notificationPrefs.route"));
const internal_route_1 = __importDefault(require("./routes/internal.route"));
const admin_route_1 = __importDefault(require("./routes/admin.route"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.use("/api/health", health_route_1.default);
// Public auth routes (no auth required)
app.use("/auth", auth_route_1.default);
// Internal service-to-service routes (service token auth)
app.use("/internal", internal_route_1.default);
// Protected customer routes (gateway forwards x-user-* headers)
app.use("/customers", authenticate_middleware_1.authenticateFromHeaders, profile_route_1.default);
app.use("/customers/addresses", authenticate_middleware_1.authenticateFromHeaders, address_route_1.default);
app.use("/customers/favorites", authenticate_middleware_1.authenticateFromHeaders, favorite_route_1.default);
app.use("/customers/notifications", authenticate_middleware_1.authenticateFromHeaders, notificationPrefs_route_1.default);
// Admin routes (gateway forwards headers + checks admin role)
app.use("/admin", admin_route_1.default);
app.use(notFound_middleware_1.notFound);
app.use(errorHandler_middleware_1.errorHandler);
app.listen(env_1.config.port, () => console.log(`[Identity] Service online on port ${env_1.config.port}`));
//# sourceMappingURL=index.js.map