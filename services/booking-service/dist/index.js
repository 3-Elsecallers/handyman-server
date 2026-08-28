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
const kafkaConsumer_1 = require("./services/kafkaConsumer");
const health_route_1 = __importDefault(require("./routes/health.route"));
const booking_route_1 = __importDefault(require("./routes/booking.route"));
const customer_route_1 = __importDefault(require("./routes/customer.route"));
const provider_route_1 = __importDefault(require("./routes/provider.route"));
const internal_route_1 = __importDefault(require("./routes/internal.route"));
const admin_route_1 = __importDefault(require("./routes/admin.route"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.use("/api/health", health_route_1.default);
// Internal service-to-service routes (service token auth)
app.use("/internal", internal_route_1.default);
// Client-facing booking routes (customer or provider)
app.use("/bookings", authenticate_middleware_1.authenticateFromHeaders, booking_route_1.default);
// Customer list bookings
app.use("/customers", authenticate_middleware_1.authenticateFromHeaders, (0, authenticate_middleware_1.requireRole)("customer"), customer_route_1.default);
// Provider self-service bookings
app.use("/providers/me", authenticate_middleware_1.authenticateFromHeaders, (0, authenticate_middleware_1.requireRole)("provider"), provider_route_1.default);
// Admin routes (admin role)
app.use("/admin", admin_route_1.default);
app.use(notFound_middleware_1.notFound);
app.use(errorHandler_middleware_1.errorHandler);
// Start Kafka consumers
(0, kafkaConsumer_1.startKafkaConsumers)().catch((err) => {
    console.error("[Booking] Failed to start Kafka consumers:", err);
});
app.listen(env_1.config.port, () => console.log(`[Booking] Service online on port ${env_1.config.port}`));
//# sourceMappingURL=index.js.map