import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import type { UpdateAvailabilityInput, CreateBlockedSlotInput } from "../validation/availabilityValidation";

export const getAvailability = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  return prisma.availability.findMany({
    where: { providerId: profile.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
};

export const updateAvailability = async (userId: string, input: UpdateAvailabilityInput) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  await prisma.availability.deleteMany({ where: { providerId: profile.id } });

  if (input.slots.length > 0) {
    await prisma.availability.createMany({
      data: input.slots.map((slot) => ({
        providerId: profile.id,
        ...slot,
      })),
    });
  }

  await publishEvent("provider.availability.changed", profile.id, {
    providerId: profile.id,
    schedule: input.slots,
  });

  return prisma.availability.findMany({
    where: { providerId: profile.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
};

export const addBlockedSlot = async (userId: string, input: CreateBlockedSlotInput) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  return prisma.blockedSlot.create({
    data: {
      providerId: profile.id,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      reason: input.reason,
    },
  });
};

export const removeBlockedSlot = async (userId: string, slotId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const slot = await prisma.blockedSlot.findFirst({
    where: { id: slotId, providerId: profile.id },
  });
  if (!slot) throw new AppError(404, "Blocked slot not found");

  await prisma.blockedSlot.delete({ where: { id: slotId } });
};

export const validateAvailability = async (
  providerId: string,
  scheduledAt: string,
  durationMins: number,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const date = new Date(scheduledAt);
  const dayOfWeek = date.getDay();
  const endTime = new Date(date.getTime() + durationMins * 60 * 1000);
  const startHHMM = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  const endHHMM = `${String(endTime.getHours()).padStart(2, "0")}:${String(endTime.getMinutes()).padStart(2, "0")}`;

  const recurringSlot = await prisma.availability.findFirst({
    where: {
      providerId,
      dayOfWeek,
      startTime: { lte: startHHMM },
      endTime: { gte: endHHMM },
      isRecurring: true,
    },
  });

  if (!recurringSlot) {
    return { available: false, conflicts: ["No matching availability slot"] };
  }

  const blocked = await prisma.blockedSlot.findFirst({
    where: {
      providerId,
      startAt: { lte: endTime },
      endAt: { gte: date },
    },
  });

  if (blocked) {
    return { available: false, conflicts: ["Time slot is blocked"] };
  }

  return { available: true, conflicts: [] };
};
