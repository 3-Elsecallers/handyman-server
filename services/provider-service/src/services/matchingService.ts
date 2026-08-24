import { prisma } from "../db/prisma";
import { haversineDistance } from "../utils/distance";
import { validateAvailability } from "./availabilityService";
import type { MatchProvidersInput } from "../validation/searchValidation";

const WEIGHTS = {
  proximity: 0.30,
  availability: 0.25,
  rating: 0.20,
  completionRate: 0.10,
  responseTime: 0.10,
  experience: 0.05,
};

const MAX_DISTANCE_KM = 50;
const MAX_RESPONSE_TIME_MINS = 120;

export const findMatchingProviders = async (input: MatchProvidersInput) => {
  const { serviceId, lat, lng, scheduledAt, durationMins, limit } = input;

  const candidates = await prisma.providerProfile.findMany({
    where: {
      status: "active",
      verified: true,
      services: {
        some: { serviceId, isActive: true },
      },
    },
    include: {
      services: {
        where: { serviceId, isActive: true },
      },
    },
  });

  const scored = await Promise.all(
    candidates.map(async (p) => {
      const distanceKm = p.lat != null && p.lng != null
        ? haversineDistance(lat, lng, p.lat, p.lng)
        : MAX_DISTANCE_KM + 1;

      if (distanceKm > MAX_DISTANCE_KM && p.lat != null) {
        return null;
      }

      const { available } = await validateAvailability(p.id, scheduledAt, durationMins);
      if (!available) return null;

      const proximityScore = Math.max(0, 1 - distanceKm / MAX_DISTANCE_KM);
      const availabilityScore = 1;
      const ratingScore = p.avgRating / 5;
      const completionScore = p.completionRate;
      const responseScore = p.avgResponseTimeMins != null
        ? Math.max(0, 1 - p.avgResponseTimeMins / MAX_RESPONSE_TIME_MINS)
        : 0.5;
      const experienceScore = Math.min(p.totalJobs / 100, 1);

      const score =
        WEIGHTS.proximity * proximityScore +
        WEIGHTS.availability * availabilityScore +
        WEIGHTS.rating * ratingScore +
        WEIGHTS.completionRate * completionScore +
        WEIGHTS.responseTime * responseScore +
        WEIGHTS.experience * experienceScore;

      return {
        providerId: p.id,
        userId: p.userId,
        distanceKm: Math.round(distanceKm * 100) / 100,
        avgRating: p.avgRating,
        score: Math.round(score * 100) / 100,
        availableSlots: [scheduledAt],
      };
    }),
  );

  return scored
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};
