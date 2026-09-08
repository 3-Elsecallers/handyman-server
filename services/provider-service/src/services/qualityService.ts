import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import { config } from "../config/env";

type Grade = "bronze" | "silver" | "gold" | "platinum";
type Tier = "apprentice" | "journeyman" | "master";

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
      const data = (await response.json()) as { data: ProviderUserInfo[] };
      if (Array.isArray(data.data)) {
        for (const user of data.data) {
          userMap.set(user.id, user);
        }
      }
    }
  } catch {
    console.error("[Quality] Failed to fetch user info from identity-service");
  }

  return userMap;
}

const GRADE_ORDER: Record<Grade, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };
const TIER_ORDER: Record<Tier, number> = { apprentice: 0, journeyman: 1, master: 2 };

interface QualityContext {
  windowOutcomes?: Array<{ outcome: string; createdAt: Date }>;
  activeComplaints?: number;
  avgResponseTimeMins: number | null;
}

const tenureYears = (joinedAt: Date | null, now: Date): number => {
  const base = joinedAt ?? now;
  return (now.getTime() - base.getTime()) / (1000 * 60 * 60 * 24 * 365);
};

const tenureMonths = (joinedAt: Date | null, now: Date): number => {
  const base = joinedAt ?? now;
  return (now.getTime() - base.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
};

export function computeTier(
  profile: {
    totalJobs: number;
    avgRating: number;
    joinedAt: Date | null;
  },
  now: Date = new Date(),
): Tier {
  if (profile.totalJobs >= 15 && profile.avgRating >= 4.5 && tenureMonths(profile.joinedAt, now) >= 6) {
    return "master";
  }
  if (profile.totalJobs >= 3 && profile.avgRating >= 4.0) {
    return "journeyman";
  }
  return "apprentice";
}

export function computeGrade(
  profile: {
    totalJobs: number;
    avgRating: number;
    completionRate: number;
    avgResponseTimeMins: number | null;
    joinedAt: Date | null;
  },
  ctx: QualityContext,
  now: Date = new Date(),
): Grade {
  const platinum =
    profile.totalJobs >= 50 &&
    profile.avgRating >= 4.7 &&
    profile.completionRate >= 0.98 &&
    (profile.avgResponseTimeMins === null || profile.avgResponseTimeMins <= 15) &&
    tenureMonths(profile.joinedAt, now) >= 6 &&
    (ctx.activeComplaints ?? 0) === 0;

  const gold =
    profile.totalJobs >= 25 &&
    profile.avgRating >= 4.3 &&
    profile.completionRate >= 0.95 &&
    (profile.avgResponseTimeMins === null || profile.avgResponseTimeMins <= 30) &&
    tenureMonths(profile.joinedAt, now) >= 3;

  const silver =
    profile.totalJobs >= 10 &&
    profile.avgRating >= 4.0 &&
    profile.completionRate >= 0.9 &&
    (profile.avgResponseTimeMins === null || profile.avgResponseTimeMins <= 60);

  if (platinum) return "platinum";
  if (gold) return "gold";
  if (silver) return "silver";
  return "bronze";
}

export interface FlagCandidate {
  code: string;
  message: string;
  severity: "warning" | "critical";
}

export function evaluateQualityFlags(
  profile: {
    avgRating: number;
    totalReviews: number;
    totalJobs: number;
    completionRate: number;
    avgResponseTimeMins: number | null;
  },
  ctx: QualityContext,
): FlagCandidate[] {
  const flags: FlagCandidate[] = [];
  const outcomes = ctx.windowOutcomes ?? [];
  const windowTotal = outcomes.length;
  const providerCancels = outcomes.filter((o) => o.outcome === "cancelled_provider").length;
  const customerCancels = outcomes.filter((o) => o.outcome === "cancelled_customer").length;
  const disputed = outcomes.filter((o) => o.outcome === "disputed").length;

  if (profile.totalReviews >= 10 && profile.avgRating < 3.5) {
    flags.push({ code: "LOW_RATING", severity: "warning", message: "Average rating is below 3.5." });
  }
  if (windowTotal >= 50 && profile.completionRate < 0.8) {
    flags.push({ code: "LOW_COMPLETION", severity: "warning", message: "Completion rate is below 80%." });
  }
  if (windowTotal >= 50 && (providerCancels + customerCancels) / windowTotal > 0.2) {
    flags.push({ code: "HIGH_CANCELLATION", severity: "warning", message: "Cancellation rate is above 20%." });
  }
  if (windowTotal >= 50 && disputed / windowTotal > 0.05) {
    flags.push({ code: "HIGH_DISPUTE", severity: "warning", message: "Dispute rate is above 5%." });
  }
  if (profile.avgResponseTimeMins !== null && profile.avgResponseTimeMins > 240) {
    flags.push({ code: "SLOW_RESPONSE", severity: "warning", message: "Average response time is above 4 hours." });
  }
  if (outcomes.some((o) => o.outcome === "no_show")) {
    flags.push({ code: "NO_SHOW", severity: "critical", message: "A no-show was recorded." });
  }

  return flags;
}

export const recalculateProvider = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
  });
  if (!profile) return null;

  const now = new Date();
  const windowOutcomes = await prisma.providerBookingWindow.findMany({
    where: { providerId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { outcome: true, createdAt: true },
  });
  const activeComplaints = 0;

  const ctx: QualityContext = { windowOutcomes, activeComplaints, avgResponseTimeMins: profile.avgResponseTimeMins };

  const tier = computeTier(profile, now);
  const grade = computeGrade(
    {
      totalJobs: profile.totalJobs,
      avgRating: profile.avgRating,
      completionRate: profile.completionRate,
      avgResponseTimeMins: profile.avgResponseTimeMins,
      joinedAt: profile.joinedAt,
    },
    ctx,
    now,
  );
  const flags = evaluateQualityFlags(profile, ctx);

  const activeFlagRows = await prisma.providerQualityFlag.findMany({
    where: { providerId, active: true },
  });
  const existingByCode = new Map(activeFlagRows.map((f) => [f.code, f]));

  for (const flag of flags) {
    if (!existingByCode.has(flag.code)) {
      await prisma.providerQualityFlag.create({
        data: {
          providerId,
          code: flag.code,
          message: flag.message,
          severity: flag.severity,
        },
      });
    } else {
      const row = existingByCode.get(flag.code)!;
      if (row.message !== flag.message || row.severity !== flag.severity) {
        await prisma.providerQualityFlag.update({
          where: { id: row.id },
          data: { message: flag.message, severity: flag.severity },
        });
      }
      existingByCode.delete(flag.code);
    }
  }

  const newlyResolved = existingByCode;
  for (const [code, row] of newlyResolved) {
    await prisma.providerQualityFlag.update({
      where: { id: row.id },
      data: { active: false, resolvedAt: now },
    });
    void code;
  }

  const updated = await prisma.providerProfile.update({
    where: { id: providerId },
    data: {
      competencyTier: tier,
      qualityGrade: grade,
      lastQualityReview: now,
      flaggedConditions: flags.length > 0 ? ({ conditions: flags } as object) : [],
    },
  });

  if (TIER_ORDER[tier] > TIER_ORDER[profile.competencyTier as Tier] ||
      GRADE_ORDER[grade] > GRADE_ORDER[profile.qualityGrade as Grade]) {
    await publishEvent("provider.quality.recalculated", providerId, {
      providerId,
      tier,
      grade,
      flags: flags.map((f) => f.code),
    });
  }

  return updated;
};

export const getScorecard = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const now = new Date();
  const windowOutcomes = await prisma.providerBookingWindow.findMany({
    where: { providerId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { outcome: true, createdAt: true },
  });
  const ctx: QualityContext = { windowOutcomes, activeComplaints: 0, avgResponseTimeMins: profile.avgResponseTimeMins };

  const windowTotal = windowOutcomes.length;
  const providerCancels = windowOutcomes.filter((o) => o.outcome === "cancelled_provider").length;
  const disputed = windowOutcomes.filter((o) => o.outcome === "disputed").length;

  const activeFlags = await prisma.providerQualityFlag.findMany({
    where: { providerId: profile.id, active: true },
    orderBy: { severity: "desc" },
  });

  return {
    scorecard: {
      tier: profile.competencyTier,
      grade: profile.qualityGrade,
      probation: {
        active: Boolean(
          profile.probationaryEndDate &&
          (profile.probationaryBookingsRemaining === null ||
            profile.probationaryBookingsRemaining === undefined ||
            profile.probationaryBookingsRemaining > 0) &&
          profile.probationaryEndDate > now,
        ),
        bookingsRemaining: profile.probationaryBookingsRemaining ?? 0,
        endDate: profile.probationaryEndDate,
      },
      metrics: {
        avgRating: profile.avgRating,
        totalReviews: profile.totalReviews,
        totalJobs: profile.totalJobs,
        completionRate: profile.completionRate,
        cancellationRate: windowTotal > 0 ? providerCancels / windowTotal : 0,
        disputeRate: windowTotal > 0 ? disputed / windowTotal : 0,
        avgResponseTimeMins: profile.avgResponseTimeMins,
      },
      tenureDays: Math.floor(
        (now.getTime() - (profile.joinedAt ?? profile.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      ),
    },
    flags: activeFlags,
  };
};

export const listProviderQuality = async (
  filters: { grade?: string; tier?: string; status?: string; flagged?: boolean },
  page = 1,
  limit = 20,
) => {
  const skip = (page - 1) * limit;
  const where: Record<string, unknown> = {};
  if (filters.grade) where.qualityGrade = filters.grade;
  if (filters.tier) where.competencyTier = filters.tier;
  if (filters.status) where.status = filters.status;
  if (filters.flagged) where.flaggedConditions = { not: [] };

  const [providers, total] = await Promise.all([
    prisma.providerProfile.findMany({
      where: where as never,
      orderBy: { avgRating: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        userId: true,
        avgRating: true,
        totalReviews: true,
        totalJobs: true,
        completionRate: true,
        avgResponseTimeMins: true,
        competencyTier: true,
        qualityGrade: true,
        status: true,
        verified: true,
        flaggedConditions: true,
      },
    }),
    prisma.providerProfile.count({ where: where as never }),
  ]);

  const flaggedCounts = await prisma.providerQualityFlag.groupBy({
    by: ["providerId"],
    where: { active: true },
    _count: { _all: true },
  });
  const flagCountMap = new Map(flaggedCounts.map((f) => [f.providerId, f._count._all]));

  const userMap = await fetchUsersForProviders(providers.map((p) => p.userId));

  return {
    providers: providers.map((p) => ({
      ...p,
      activeFlagCount: flagCountMap.get(p.id) ?? 0,
      user: userMap.get(p.userId) ?? null,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
};

export const getProviderQualityDetail = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const flags = await prisma.providerQualityFlag.findMany({
    where: { providerId },
    orderBy: { active: "desc" },
  });

  const scorecard = await getScorecardForProfile(profile);
  return { ...scorecard, flags };
};

const getScorecardForProfile = async (profile: {
  id: string;
  userId: string;
  avgRating: number;
  totalReviews: number;
  totalJobs: number;
  completionRate: number;
  avgResponseTimeMins: number | null;
  competencyTier: string;
  qualityGrade: string;
  probationaryEndDate: Date | null;
  probationaryBookingsRemaining: number | null;
  joinedAt: Date | null;
  createdAt: Date;
  status: string;
}) => {
  const now = new Date();
  const windowOutcomes = await prisma.providerBookingWindow.findMany({
    where: { providerId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { outcome: true, createdAt: true },
  });
  const windowTotal = windowOutcomes.length;
  const providerCancels = windowOutcomes.filter((o) => o.outcome === "cancelled_provider").length;
  const disputed = windowOutcomes.filter((o) => o.outcome === "disputed").length;
  const ctx: QualityContext = { windowOutcomes, activeComplaints: 0, avgResponseTimeMins: profile.avgResponseTimeMins };

  return {
    scorecard: {
      tier: profile.competencyTier,
      grade: profile.qualityGrade,
      probation: {
        active: Boolean(
          profile.probationaryEndDate &&
          (profile.probationaryBookingsRemaining === null ||
            profile.probationaryBookingsRemaining === undefined ||
            profile.probationaryBookingsRemaining > 0) &&
          profile.probationaryEndDate > now,
        ),
        bookingsRemaining: profile.probationaryBookingsRemaining ?? 0,
        endDate: profile.probationaryEndDate,
      },
      metrics: {
        avgRating: profile.avgRating,
        totalReviews: profile.totalReviews,
        totalJobs: profile.totalJobs,
        completionRate: profile.completionRate,
        cancellationRate: windowTotal > 0 ? providerCancels / windowTotal : 0,
        disputeRate: windowTotal > 0 ? disputed / windowTotal : 0,
        avgResponseTimeMins: profile.avgResponseTimeMins,
      },
      tenureDays: Math.floor(
        (now.getTime() - (profile.joinedAt ?? profile.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      ),
    },
    ctx,
  };
};

export const resolveQualityFlag = async (flagId: string, adminId: string) => {
  const flag = await prisma.providerQualityFlag.findUnique({ where: { id: flagId } });
  if (!flag) throw new AppError(404, "Flag not found");

  const updated = await prisma.providerQualityFlag.update({
    where: { id: flagId },
    data: { active: false, resolvedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "quality_flag_resolved",
      targetType: "provider_quality_flag",
      targetId: flagId,
      metadata: { providerId: flag.providerId, code: flag.code },
    },
  });

  return updated;
};

export const recalculateAllProviders = async () => {
  const providers = await prisma.providerProfile.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  for (const p of providers) {
    try {
      await recalculateProvider(p.id);
    } catch (err) {
      console.error(`[Quality] Recalc failed for ${p.id}:`, err);
    }
  }
  return { recalculated: providers.length };
};
