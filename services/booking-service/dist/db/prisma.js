"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const prisma_1 = require("../../generated/prisma");
const adapter_pg_1 = require("@prisma/adapter-pg");
const globalForPrisma = globalThis;
const createPrismaClient = () => {
    const adapter = new adapter_pg_1.PrismaPg({
        connectionString: process.env.DATABASE_URL,
    });
    return new prisma_1.PrismaClient({ adapter });
};
exports.prisma = globalForPrisma.prisma || createPrismaClient();
if (process.env.NODE_ENV !== "production")
    globalForPrisma.prisma = exports.prisma;
//# sourceMappingURL=prisma.js.map