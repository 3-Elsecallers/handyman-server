"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAddress = exports.updateAddress = exports.createAddress = exports.listAddresses = void 0;
const prisma_1 = require("../db/prisma");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const MAX_ADDRESSES = 10;
const listAddresses = async (userId) => {
    return prisma_1.prisma.address.findMany({
        where: { userId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
};
exports.listAddresses = listAddresses;
const createAddress = async (userId, input) => {
    const count = await prisma_1.prisma.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES) {
        throw new errorHandler_middleware_1.AppError(400, `Maximum ${MAX_ADDRESSES} addresses allowed`);
    }
    if (input.isDefault) {
        await prisma_1.prisma.address.updateMany({
            where: { userId, isDefault: true },
            data: { isDefault: false },
        });
    }
    if (count === 0) {
        input.isDefault = true;
    }
    return prisma_1.prisma.address.create({
        data: { userId, ...input },
    });
};
exports.createAddress = createAddress;
const updateAddress = async (userId, addressId, input) => {
    const address = await prisma_1.prisma.address.findFirst({
        where: { id: addressId, userId },
    });
    if (!address)
        throw new errorHandler_middleware_1.AppError(404, "Address not found");
    if (input.isDefault) {
        await prisma_1.prisma.address.updateMany({
            where: { userId, isDefault: true, id: { not: addressId } },
            data: { isDefault: false },
        });
    }
    return prisma_1.prisma.address.update({
        where: { id: addressId },
        data: input,
    });
};
exports.updateAddress = updateAddress;
const deleteAddress = async (userId, addressId) => {
    const address = await prisma_1.prisma.address.findFirst({
        where: { id: addressId, userId },
    });
    if (!address)
        throw new errorHandler_middleware_1.AppError(404, "Address not found");
    await prisma_1.prisma.address.delete({ where: { id: addressId } });
    if (address.isDefault) {
        const latest = await prisma_1.prisma.address.findFirst({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        if (latest) {
            await prisma_1.prisma.address.update({
                where: { id: latest.id },
                data: { isDefault: true },
            });
        }
    }
};
exports.deleteAddress = deleteAddress;
//# sourceMappingURL=addressService.js.map