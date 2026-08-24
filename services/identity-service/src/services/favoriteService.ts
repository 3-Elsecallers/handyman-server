import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";

export const listFavorites = async (customerId: string) => {
  return prisma.favoriteProvider.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
};

export const addFavorite = async (customerId: string, providerId: string) => {
  const existing = await prisma.favoriteProvider.findUnique({
    where: { customerId_providerId: { customerId, providerId } },
  });

  if (existing) {
    throw new AppError(409, "Provider already in favorites");
  }

  return prisma.favoriteProvider.create({
    data: { customerId, providerId },
  });
};

export const removeFavorite = async (
  customerId: string,
  providerId: string,
) => {
  const favorite = await prisma.favoriteProvider.findUnique({
    where: { customerId_providerId: { customerId, providerId } },
  });

  if (!favorite) {
    throw new AppError(404, "Favorite not found");
  }

  await prisma.favoriteProvider.delete({
    where: { customerId_providerId: { customerId, providerId } },
  });
};
