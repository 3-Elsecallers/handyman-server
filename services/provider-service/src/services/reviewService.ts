import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";


export const submitReview = async (
  bookingId: string,
  customerId: string,
  providerId: string,
  rating: number,
  comment?: string,
  photoUrls?: string[],
) => {
  const existing = await prisma.review.findUnique({ where: { bookingId } });
  if (existing) throw new AppError(409, "Review already submitted for this booking");

  const provider = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!provider) throw new AppError(404, "Provider not found");

  const review = await prisma.review.create({
    data: {
      bookingId,
      customerId,
      providerId,
      rating,
      comment,
      photoUrls: photoUrls || [],
    },
  });

  const stats = await computeProviderStats(providerId);

  await prisma.providerProfile.update({
    where: { id: providerId },
    data: {
      avgRating: stats.avgRating,
      totalReviews: stats.totalReviews,
    },
  });

  await publishEvent("provider.review.submitted", review.id, {
    reviewId: review.id,
    providerId,
    rating,
    customerId,
    bookingId,
  });

  await publishEvent("provider.stats.updated", providerId, {
    providerId,
    avgRating: stats.avgRating,
    totalJobs: provider.totalJobs,
    completionRate: provider.completionRate,
  });

  return review;
};

export const listReviews = async (providerId: string, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { providerId, status: "visible" },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({
      where: { providerId, status: "visible" },
    }),
  ]);

  return { reviews, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const respondToReview = async (
  userId: string,
  reviewId: string,
  response: string,
) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new AppError(404, "Review not found");

  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile || profile.id !== review.providerId) {
    throw new AppError(403, "Not authorized to respond to this review");
  }

  if (review.providerResponse) {
    throw new AppError(409, "Already responded to this review");
  }

  return prisma.review.update({
    where: { id: reviewId },
    data: { providerResponse: response },
  });
};

export const flagReview = async (reviewId: string) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new AppError(404, "Review not found");

  return prisma.review.update({
    where: { id: reviewId },
    data: { status: "flagged" },
  });
};

export const getFlaggedReviews = async (page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where: { status: "flagged" },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.review.count({ where: { status: "flagged" } }),
  ]);

  return { reviews, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export const moderateReview = async (
  reviewId: string,
  status: "visible" | "flagged" | "removed",
) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new AppError(404, "Review not found");

  return prisma.review.update({
    where: { id: reviewId },
    data: { status },
  });
};

const computeProviderStats = async (providerId: string) => {
  const result = await prisma.review.aggregate({
    where: { providerId, status: "visible" },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return {
    avgRating: result._avg.rating || 0,
    totalReviews: result._count.rating,
  };
};

export const incrementJobStats = async (providerId: string, completed: boolean) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) return;

  const totalJobs = profile.totalJobs + 1;
  const completedJobs = completed
    ? Math.round(profile.completionRate * profile.totalJobs) + 1
    : Math.round(profile.completionRate * profile.totalJobs);
  const completionRate = totalJobs > 0 ? completedJobs / totalJobs : 1;

  await prisma.providerProfile.update({
    where: { id: providerId },
    data: { totalJobs, completionRate },
  });
};
