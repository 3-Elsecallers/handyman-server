import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import type { CreateCategoryInput, CreateServiceInput } from "../validation/serviceValidation";

export const listCategories = async () => {
  return prisma.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
};

export const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.serviceCategory.findUnique({ where: { slug } });
  if (!category) throw new AppError(404, "Category not found");
  return category;
};

export const listServices = async (categoryId?: string) => {
  return prisma.service.findMany({
    where: { isActive: true, ...(categoryId ? { categoryId } : {}) },
    include: { category: true },
    orderBy: { sortOrder: "asc" },
  });
};

export const getServiceBySlug = async (slug: string) => {
  const service = await prisma.service.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!service) throw new AppError(404, "Service not found");
  return service;
};

export const getServiceById = async (id: string) => {
  const service = await prisma.service.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!service) throw new AppError(404, "Service not found");
  return service;
};

export const createCategory = async (input: CreateCategoryInput) => {
  const existing = await prisma.serviceCategory.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError(409, "Category slug already exists");

  return prisma.serviceCategory.create({ data: input });
};

export const updateCategory = async (
  id: string,
  input: Partial<CreateCategoryInput>,
) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id } });
  if (!category) throw new AppError(404, "Category not found");

  if (input.slug && input.slug !== category.slug) {
    const slugExists = await prisma.serviceCategory.findUnique({ where: { slug: input.slug } });
    if (slugExists) throw new AppError(409, "Category slug already exists");
  }

  return prisma.serviceCategory.update({ where: { id }, data: input });
};

export const createService = async (input: CreateServiceInput) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError(404, "Category not found");

  const existing = await prisma.service.findUnique({ where: { slug: input.slug } });
  if (existing) throw new AppError(409, "Service slug already exists");

  const service = await prisma.service.create({ data: input });

  await publishEvent("catalog.service.created", service.id, {
    serviceId: service.id,
    name: service.name,
    slug: service.slug,
    categoryId: service.categoryId,
    basePrice: service.basePrice,
  });

  return service;
};

export const updateService = async (
  id: string,
  input: Partial<CreateServiceInput>,
) => {
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new AppError(404, "Service not found");

  if (input.slug && input.slug !== service.slug) {
    const slugExists = await prisma.service.findUnique({ where: { slug: input.slug } });
    if (slugExists) throw new AppError(409, "Service slug already exists");
  }

  return prisma.service.update({ where: { id }, data: input });
};
