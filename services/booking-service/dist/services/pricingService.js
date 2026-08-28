"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computePrice = exports.computeTravelFee = exports.getSurgeRate = void 0;
const env_1 = require("../config/env");
const distance_1 = require("../utils/distance");
const HOLIDAYS_2026 = [
    [1, 1], [1, 19], [2, 16], [5, 25], [6, 19], [7, 3], [9, 7],
    [10, 12], [11, 11], [11, 26], [12, 25],
];
const isHoliday = (date) => {
    return HOLIDAYS_2026.some(([m, d]) => date.getMonth() + 1 === m && date.getDate() === d);
};
const getSurgeRate = (scheduledAt) => {
    const { pricing } = env_1.config;
    if (isHoliday(scheduledAt))
        return pricing.surgeHoliday;
    const day = scheduledAt.getDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend)
        return pricing.surgeWeekend;
    const hour = scheduledAt.getHours();
    const isEvening = hour >= pricing.surgeEveningHourStart && hour < pricing.surgeEveningHourEnd;
    if (isEvening)
        return pricing.surgeEvening;
    return 0;
};
exports.getSurgeRate = getSurgeRate;
const computeTravelFee = (distanceKm) => {
    const { pricing } = env_1.config;
    const billableKm = Math.max(0, distanceKm - pricing.freeRadiusKm);
    return Math.round(billableKm * pricing.ratePerKm * 100) / 100;
};
exports.computeTravelFee = computeTravelFee;
const computePrice = (input) => {
    const { pricing } = env_1.config;
    const complexityMultiplier = pricing.complexityMultipliers[input.complexity];
    const complexityAdjusted = input.basePrice * complexityMultiplier;
    let travelFee = 0;
    if (input.providerLat != null && input.providerLng != null) {
        const distance = (0, distance_1.haversineDistance)(input.customerLat, input.customerLng, input.providerLat, input.providerLng);
        travelFee = (0, exports.computeTravelFee)(distance);
    }
    const surgeRate = (0, exports.getSurgeRate)(input.scheduledAt);
    const surgeAmount = Math.round(complexityAdjusted * surgeRate * 100) / 100;
    const promoDiscount = Math.round(input.promoDiscount * 100) / 100;
    const finalPrice = Math.max(0, Math.round((complexityAdjusted + travelFee + surgeAmount - promoDiscount) * 100) / 100);
    return {
        basePrice: input.basePrice,
        complexityMultiplier,
        complexityAdjusted: Math.round(complexityAdjusted * 100) / 100,
        travelFee,
        surgeAmount,
        promoDiscount,
        finalPrice,
    };
};
exports.computePrice = computePrice;
//# sourceMappingURL=pricingService.js.map