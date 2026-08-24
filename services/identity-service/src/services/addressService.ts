import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import type { CreateAddressInput, UpdateAddressInput } from "../validation/addressValidation";

const MAX_ADDRESSES = 10;

export const listAddresses = async (userId: string) => {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
};

export const createAddress = async (
  userId: string,
  input: CreateAddressInput,
) => {
  const count = await prisma.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) {
    throw new AppError(400, `Maximum ${MAX_ADDRESSES} addresses allowed`);
  }

  if (input.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  if (count === 0) {
    input.isDefault = true;
  }

  return prisma.address.create({
    data: { userId, ...input },
  });
};

export const updateAddress = async (
  userId: string,
  addressId: string,
  input: UpdateAddressInput,
) => {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) throw new AppError(404, "Address not found");

  if (input.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true, id: { not: addressId } },
      data: { isDefault: false },
    });
  }

  return prisma.address.update({
    where: { id: addressId },
    data: input,
  });
};

export const deleteAddress = async (userId: string, addressId: string) => {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) throw new AppError(404, "Address not found");

  await prisma.address.delete({ where: { id: addressId } });

  if (address.isDefault) {
    const latest = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (latest) {
      await prisma.address.update({
        where: { id: latest.id },
        data: { isDefault: true },
      });
    }
  }
};
