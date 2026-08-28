"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchProviderCandidates = exports.validateProviderAvailability = exports.fetchService = exports.fetchProvider = exports.fetchUser = void 0;
const env_1 = require("../config/env");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const headers = {
    "content-type": "application/json",
    "x-service-token": env_1.config.internalServiceToken,
};
const fetchUser = async (userId) => {
    const res = await fetch(`${env_1.config.identityServiceUrl}/internal/users/${userId}`, {
        headers,
    });
    if (!res.ok) {
        throw new errorHandler_middleware_1.AppError(502, "Identity service unavailable");
    }
    const { data } = (await res.json());
    return data;
};
exports.fetchUser = fetchUser;
const fetchProvider = async (providerId) => {
    const res = await fetch(`${env_1.config.providerServiceUrl}/internal/providers/${providerId}`, {
        headers,
    });
    if (!res.ok) {
        throw new errorHandler_middleware_1.AppError(404, "Provider not found");
    }
    const { data } = (await res.json());
    return data;
};
exports.fetchProvider = fetchProvider;
const fetchService = async (serviceId) => {
    const res = await fetch(`${env_1.config.providerServiceUrl}/internal/services/${serviceId}`, {
        headers,
    });
    if (!res.ok) {
        throw new errorHandler_middleware_1.AppError(404, "Service not found");
    }
    const { data } = (await res.json());
    return data;
};
exports.fetchService = fetchService;
const validateProviderAvailability = async (providerId, scheduledAt, durationMins) => {
    const res = await fetch(`${env_1.config.providerServiceUrl}/internal/providers/${providerId}/availability/validate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ scheduledAt, durationMins }),
    });
    if (!res.ok) {
        throw new errorHandler_middleware_1.AppError(502, "Provider service unavailable");
    }
    const { data } = (await res.json());
    return data;
};
exports.validateProviderAvailability = validateProviderAvailability;
const matchProviderCandidates = async (input) => {
    const res = await fetch(`${env_1.config.providerServiceUrl}/internal/providers/match`, {
        method: "POST",
        headers,
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        throw new errorHandler_middleware_1.AppError(502, "Provider matching service unavailable");
    }
    const { data } = (await res.json());
    return data.matches;
};
exports.matchProviderCandidates = matchProviderCandidates;
//# sourceMappingURL=serviceClient.js.map