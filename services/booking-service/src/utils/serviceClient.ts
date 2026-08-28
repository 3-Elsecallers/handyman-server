import { config } from "../config/env";
import { AppError } from "../middlewares/errorHandler.middleware";

export interface InternalUser {
  id: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  role: string;
  createdAt?: string;
}

export interface InternalService {
  id: string;
  name: string;
  slug: string;
  description?: string;
  basePrice: number;
  durationMins: number;
  categoryId: string;
  category?: { id: string; name: string; slug: string };
}

export interface AvailabilityResult {
  available: boolean;
  conflicts: string[];
}

export interface MatchedProvider {
  providerId: string;
  userId: string;
  distanceKm: number;
  avgRating: number;
  score: number;
  availableSlots: string[];
}

export interface ProviderProfile {
  id: string;
  userId: string;
  status: string;
  verified: boolean;
  lat?: number | null;
  lng?: number | null;
  avgRating?: number;
  totalReviews?: number;
  totalJobs?: number;
  avgResponseTimeMins?: number | null;
  bio?: string | null;
}

const headers = {
  "content-type": "application/json",
  "x-service-token": config.internalServiceToken,
};

export const fetchUser = async (userId: string): Promise<InternalUser> => {
  const res = await fetch(`${config.identityServiceUrl}/internal/users/${userId}`, {
    headers,
  });
  if (!res.ok) {
    throw new AppError(502, "Identity service unavailable");
  }
  const { data } = (await res.json()) as { data: InternalUser };
  return data;
};

export const fetchProvider = async (providerId: string): Promise<ProviderProfile> => {
  const res = await fetch(`${config.providerServiceUrl}/internal/providers/${providerId}`, {
    headers,
  });
  if (!res.ok) {
    throw new AppError(404, "Provider not found");
  }
  const { data } = (await res.json()) as { data: ProviderProfile };
  return data;
};

export const fetchService = async (serviceId: string): Promise<InternalService> => {
  const res = await fetch(`${config.providerServiceUrl}/internal/services/${serviceId}`, {
    headers,
  });
  if (!res.ok) {
    throw new AppError(404, "Service not found");
  }
  const { data } = (await res.json()) as { data: InternalService };
  return data;
};

export const validateProviderAvailability = async (
  providerId: string,
  scheduledAt: string,
  durationMins: number,
): Promise<AvailabilityResult> => {
  const res = await fetch(
    `${config.providerServiceUrl}/internal/providers/${providerId}/availability/validate`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ scheduledAt, durationMins }),
    },
  );
  if (!res.ok) {
    throw new AppError(502, "Provider service unavailable");
  }
  const { data } = (await res.json()) as { data: AvailabilityResult };
  return data;
};

export const matchProviderCandidates = async (input: {
  serviceId: string;
  lat: number;
  lng: number;
  scheduledAt: string;
  durationMins: number;
  limit: number;
}): Promise<MatchedProvider[]> => {
  const res = await fetch(`${config.providerServiceUrl}/internal/providers/match`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new AppError(502, "Provider matching service unavailable");
  }
  const { data } = (await res.json()) as { data: MatchedProvider[] };
  return data;
};
