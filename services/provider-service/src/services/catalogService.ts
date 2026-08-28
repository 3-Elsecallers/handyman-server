import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import type { CreateCategoryInput, CreateServiceInput } from "../validation/serviceValidation";

export const listCategories = async (includeInactive = false) => {
  const categories = await prisma.serviceCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      _count: { select: { services: { where: { isActive: true } } } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return categories.map(({ _count, ...category }) => ({
    ...category,
    serviceCount: _count.services,
  }));
};

export const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.serviceCategory.findUnique({ where: { slug } });
  if (!category) throw new AppError(404, "Category not found");
  return category;
};

export const listServices = async (categoryId?: string, search?: string, includeInactive = false) => {
  const where: Record<string, unknown> = {};

  if (!includeInactive) {
    where.isActive = true;
  }

  if (categoryId) {
    where.categoryId = categoryId;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  return prisma.service.findMany({
    where,
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
  const slug = slugify(input.name);

  const existing = await prisma.serviceCategory.findUnique({ where: { slug } });
  if (existing) throw new AppError(409, "Category slug already exists");

  return prisma.serviceCategory.create({ data: { ...input, slug } });
};

export const updateCategory = async (
  id: string,
  input: Partial<CreateCategoryInput>,
) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id } });
  if (!category) throw new AppError(404, "Category not found");

  if (input.name && slugify(input.name) !== category.slug) {
    const slugExists = await prisma.serviceCategory.findUnique({ where: { slug: slugify(input.name) } });
    if (slugExists) throw new AppError(409, "Category slug already exists");
  }

  return prisma.serviceCategory.update({ where: { id }, data: input });
};

export const createService = async (input: CreateServiceInput) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new AppError(404, "Category not found");

  const slug = slugify(input.name);

  const existing = await prisma.service.findUnique({ where: { slug } });
  if (existing) throw new AppError(409, "Service slug already exists");

  const service = await prisma.service.create({ data: { ...input, slug } });

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

  if (input.name && slugify(input.name) !== service.slug) {
    const slugExists = await prisma.service.findUnique({ where: { slug: slugify(input.name) } });
    if (slugExists) throw new AppError(409, "Service slug already exists");
  }

  return prisma.service.update({ where: { id }, data: input });
};

const slugify = (text: string) => {
  return text.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}
