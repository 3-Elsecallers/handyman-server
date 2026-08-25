import { prisma } from "../db/prisma";

export const registerDeviceToken = async (
  userId: string,
  token: string,
  platform: string,
) => {
  return prisma.deviceToken.upsert({
    where: { token },
    create: { userId, token, platform },
    update: { active: true, platform },
  });
};

export const removeDeviceToken = async (token: string) => {
  return prisma.deviceToken.deleteMany({ where: { token } });
};

export const getDeviceTokens = async (userId: string) => {
  return prisma.deviceToken.findMany({
    where: { userId, active: true },
  });
};
