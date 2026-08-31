import { prisma } from "../db/prisma";
import { config } from "../config/env";
import { haversineDistance } from "../utils/distance";
import type { SearchProvidersInput } from "../validation/searchValidation";

interface ProviderUserInfo {
  id: string;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  role: string;
  createdAt: string;
}

async function fetchUsersForProviders(userIds: string[]): Promise<Map<string, ProviderUserInfo>> {
  const userMap = new Map<string, ProviderUserInfo>();
  if (userIds.length === 0) return userMap;

  try {
    const idsParam = userIds.join(",");
    const response = await fetch(
      `${config.identityServiceUrl}/internal/users/batch?ids=${idsParam}`,
      {
        headers: {
          "x-service-token": config.internalServiceToken,
        },
      },
    );
    if (response.ok) {
      const data = await response.json() as { data: ProviderUserInfo[] };
      if (Array.isArray(data.data)) {
        for (const user of data.data) {
          userMap.set(user.id, user);
        }
      }
    }
  } catch {
    console.error("[Search] Failed to fetch user info from identity-service");
  }

  return userMap;
}

async function searchUserIds(query: string): Promise<string[]> {
  try {
    const response = await fetch(
      `${config.identityServiceUrl}/internal/users/search?query=${encodeURIComponent(query)}&limit=50`,
      {
        headers: {
          "x-service-token": config.internalServiceToken,
        },
      },
    );
    if (response.ok) {
      const data = await response.json() as { data: Array<{ id: string }> };
      if (Array.isArray(data.data)) {
        return data.data.map((u) => u.id);
      }
    }
  } catch {
    console.error("[Search] Failed to search users via identity-service");
  }
  return [];
}

export const searchProviders = async (input: SearchProvidersInput) => {
  const { lat, lng, radiusKm, categoryId, serviceId, minRating, minPrice, maxPrice, verified, q, page, limit, sortBy } = input;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    status: "active",
  };

  if (verified !== undefined) {
    where.verified = verified;
  }

  if (minRating !== undefined) {
    where.avgRating = { gte: minRating };
  }

  if (serviceId) {
    where.services = {
      some: { serviceId, isActive: true },
    };
  } else if (categoryId) {
    where.services = {
      some: { service: { categoryId }, isActive: true },
    };
  }

  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceFilter: Record<string, number> = {};
    if (minPrice !== undefined) priceFilter.gte = minPrice;
    if (maxPrice !== undefined) priceFilter.lte = maxPrice;

    where.services = {
      ...(where.services as Record<string, unknown> || {}),
      some: {
        ...(where.services as Record<string, { some: Record<string, unknown> }>)?.some || {},
        OR: [
          { customPrice: priceFilter },
          { service: { basePrice: priceFilter } },
        ],
      },
    };
  }

  // Provider name search. Names live in identity-service, so resolve matching
  // user IDs there and filter profiles by those IDs (bio/userId also matched).
  if (q && q.trim()) {
    const matchedUserIds = await searchUserIds(q.trim());
    const orConditions: Record<string, unknown>[] = [
      { bio: { contains: q.trim(), mode: "insensitive" } },
      { userId: { contains: q.trim(), mode: "insensitive" } },
    ];
    if (matchedUserIds.length > 0) {
      orConditions.push({ userId: { in: matchedUserIds } });
    }
    where.OR = orConditions;
  }

  let profiles = await prisma.providerProfile.findMany({
    where,
    include: {
      services: {
        where: { isActive: true },
        include: { service: true },
      },
    },
    skip,
    take: limit,
  });

  if (lat !== undefined && lng !== undefined) {
    profiles = profiles
      .map((p) => ({
        ...p,
        distanceKm: p.lat != null && p.lng != null
          ? haversineDistance(lat, lng, p.lat, p.lng)
          : Infinity,
      }))
      .filter((p) => p.distanceKm <= radiusKm)
      .sort((a, b) => {
        if (sortBy === "distance") return a.distanceKm - b.distanceKm;
        if (sortBy === "rating") return b.avgRating - a.avgRating;
        if (sortBy === "experience") return b.totalJobs - a.totalJobs;
        return 0;
      });
  } else if (sortBy === "rating") {
    profiles.sort((a, b) => b.avgRating - a.avgRating);
  } else if (sortBy === "experience") {
    profiles.sort((a, b) => b.totalJobs - a.totalJobs);
  }

  const total = profiles.length;

  // Enrich with the provider's user (name + avatar) from identity-service.
  const userIds = profiles.map((p) => p.userId);
  const userMap = await fetchUsersForProviders(userIds);
  const providers = profiles.map((provider) => ({
    ...provider,
    user: userMap.get(provider.userId) || null,
  }));

  return {
    providers,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const autocomplete = async (query: string) => {
  if (!query || query.length < 2) return [];

  const categories = await prisma.serviceCategory.findMany({
    where: {
      isActive: true,
      name: { contains: query, mode: "insensitive" },
    },
    take: 5,
    select: { id: true, name: true, slug: true, iconUrl: true },
  });

  const services = await prisma.service.findMany({
    where: {
      isActive: true,
      name: { contains: query, mode: "insensitive" },
    },
    take: 5,
    select: { id: true, name: true, slug: true },
  });

  return { categories, services };
};
