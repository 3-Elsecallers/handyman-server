import { config } from "../config/env";
import { haversineDistance } from "../utils/distance";

export interface PriceBreakdown {
  basePrice: number;
  complexityMultiplier: number;
  complexityAdjusted: number;
  travelFee: number;
  surgeAmount: number;
  promoDiscount: number;
  finalPrice: number;
}

export interface ComputePriceInput {
  basePrice: number;
  complexity: "standard" | "moderate" | "complex";
  scheduledAt: Date;
  customerLat: number;
  customerLng: number;
  providerLat?: number | null;
  providerLng?: number | null;
  promoDiscount: number;
}

const HOLIDAYS_2026: Array<[number, number]> = [
  [1, 1], [1, 19], [2, 16], [5, 25], [6, 19], [7, 3], [9, 7],
  [10, 12], [11, 11], [11, 26], [12, 25],
];

const isHoliday = (date: Date) => {
  return HOLIDAYS_2026.some(([m, d]) => date.getMonth() + 1 === m && date.getDate() === d);
};

export const getSurgeRate = (scheduledAt: Date): number => {
  const { pricing } = config;
  if (isHoliday(scheduledAt)) return pricing.surgeHoliday;

  const day = scheduledAt.getDay();
  const isWeekend = day === 0 || day === 6;
  if (isWeekend) return pricing.surgeWeekend;

  const hour = scheduledAt.getHours();
  const isEvening =
    hour >= pricing.surgeEveningHourStart && hour < pricing.surgeEveningHourEnd;
  if (isEvening) return pricing.surgeEvening;

  return 0;
};

export const computeTravelFee = (
  distanceKm: number,
): number => {
  const { pricing } = config;
  const billableKm = Math.max(0, distanceKm - pricing.freeRadiusKm);
  return Math.round(billableKm * pricing.ratePerKm * 100) / 100;
};

export const computePrice = (input: ComputePriceInput): PriceBreakdown => {
  const { pricing } = config;

  const complexityMultiplier = pricing.complexityMultipliers[input.complexity];
  const complexityAdjusted = input.basePrice * complexityMultiplier;

  let travelFee = 0;
  if (input.providerLat != null && input.providerLng != null) {
    const distance = haversineDistance(
      input.customerLat,
      input.customerLng,
      input.providerLat,
      input.providerLng,
    );
    travelFee = computeTravelFee(distance);
  }

  const surgeRate = getSurgeRate(input.scheduledAt);
  const surgeAmount = Math.round(complexityAdjusted * surgeRate * 100) / 100;

  const promoDiscount = Math.round(input.promoDiscount * 100) / 100;

  const finalPrice = Math.max(
    0,
    Math.round((complexityAdjusted + travelFee + surgeAmount - promoDiscount) * 100) / 100,
  );

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
