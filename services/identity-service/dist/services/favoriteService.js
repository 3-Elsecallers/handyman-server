"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.removeFavorite = exports.addFavorite = exports.listFavorites = void 0;
const prisma_1 = require("../db/prisma");
const errorHandler_middleware_1 = require("../middlewares/errorHandler.middleware");
const listFavorites = async (customerId) => {
    return prisma_1.prisma.favoriteProvider.findMany({
        where: { customerId },
        orderBy: { createdAt: "desc" },
    });
};
exports.listFavorites = listFavorites;
const addFavorite = async (customerId, providerId) => {
    const existing = await prisma_1.prisma.favoriteProvider.findUnique({
        where: { customerId_providerId: { customerId, providerId } },
    });
    if (existing) {
        throw new errorHandler_middleware_1.AppError(409, "Provider already in favorites");
    }
    return prisma_1.prisma.favoriteProvider.create({
        data: { customerId, providerId },
    });
};
exports.addFavorite = addFavorite;
const removeFavorite = async (customerId, providerId) => {
    const favorite = await prisma_1.prisma.favoriteProvider.findUnique({
        where: { customerId_providerId: { customerId, providerId } },
    });
    if (!favorite) {
        throw new errorHandler_middleware_1.AppError(404, "Favorite not found");
    }
    await prisma_1.prisma.favoriteProvider.delete({
        where: { customerId_providerId: { customerId, providerId } },
    });
};
exports.removeFavorite = removeFavorite;
//# sourceMappingURL=favoriteService.js.map