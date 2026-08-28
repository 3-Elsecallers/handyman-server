"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
require("dotenv/config");
exports.config = {
    port: parseInt(process.env.PORT || "8083", 10),
    serviceToken: process.env.SERVICE_TOKEN || "booking-service-internal-token",
    internalServiceToken: process.env.INTERNAL_SERVICE_TOKEN || "handyman-internal-service-token",
    identityServiceUrl: process.env.IDENTITY_SERVICE_URL || "http://localhost:8081",
    providerServiceUrl: process.env.PROVIDER_SERVICE_URL || "http://localhost:8082",
    kafka: {
        brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
        clientId: "booking-service",
        groupId: "booking-service-group",
    },
    pricing: {
        complexityMultipliers: {
            standard: 1.0,
            moderate: 1.2,
            complex: 1.5,
        },
        freeRadiusKm: parseFloat(process.env.PRICING_FREE_RADIUS_KM || "10"),
        ratePerKm: parseFloat(process.env.PRICING_RATE_PER_KM || "0.5"),
        surgeEvening: parseFloat(process.env.PRICING_SURGE_EVENING || "0.10"),
        surgeWeekend: parseFloat(process.env.PRICING_SURGE_WEEKEND || "0.15"),
        surgeHoliday: parseFloat(process.env.PRICING_SURGE_HOLIDAY || "0.25"),
        surgeEveningHourStart: parseInt(process.env.PRICING_EVENING_HOUR_START || "18", 10),
        surgeEveningHourEnd: parseInt(process.env.PRICING_EVENING_HOUR_END || "22", 10),
    },
};
//# sourceMappingURL=env.js.map