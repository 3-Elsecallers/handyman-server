import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import type {
  CreateRequirementInput,
  UpdateRequirementInput,
  CreateQuestionInput,
  UpdateQuestionInput,
} from "../validation/vettingValidation";

export const listRequirementsByCategory = async (categoryId: string) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError(404, "Category not found");

  return prisma.categoryVettingRequirement.findMany({
    where: { categoryId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
};

export const createRequirement = async (
  categoryId: string,
  input: CreateRequirementInput,
  adminId: string,
) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError(404, "Category not found");

  const existing = await prisma.categoryVettingRequirement.findUnique({
    where: { categoryId_name: { categoryId, name: input.name } },
  });
  if (existing) {
    throw new AppError(409, "A requirement with this name already exists in this category");
  }

  const requirement = await prisma.categoryVettingRequirement.create({
    data: { categoryId, ...input },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "requirement_created",
      targetType: "category_requirement",
      targetId: requirement.id,
      metadata: { categoryId, name: requirement.name, type: requirement.type },
    },
  });

  await publishEvent("catalog.category.requirements.updated", categoryId, {
    categoryId,
    action: "created",
    requirementId: requirement.id,
    requirementName: requirement.name,
  });

  return requirement;
};

export const updateRequirement = async (
  requirementId: string,
  input: UpdateRequirementInput,
  adminId: string,
) => {
  const existing = await prisma.categoryVettingRequirement.findUnique({
    where: { id: requirementId },
  });
  if (!existing) throw new AppError(404, "Requirement not found");

  if (input.name && input.name !== existing.name) {
    const duplicate = await prisma.categoryVettingRequirement.findUnique({
      where: { categoryId_name: { categoryId: existing.categoryId, name: input.name } },
    });
    if (duplicate) {
      throw new AppError(409, "A requirement with this name already exists in this category");
    }
  }

  const requirement = await prisma.categoryVettingRequirement.update({
    where: { id: requirementId },
    data: input,
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "requirement_updated",
      targetType: "category_requirement",
      targetId: requirementId,
      metadata: { fields: Object.keys(input) },
    },
  });

  await publishEvent("catalog.category.requirements.updated", existing.categoryId, {
    categoryId: existing.categoryId,
    action: "updated",
    requirementId,
    requirementName: requirement.name,
  });

  return requirement;
};

export const deleteRequirement = async (requirementId: string, adminId: string) => {
  const existing = await prisma.categoryVettingRequirement.findUnique({
    where: { id: requirementId },
    include: {
      documents: { select: { id: true } },
      attestations: { select: { id: true } },
    },
  });
  if (!existing) throw new AppError(404, "Requirement not found");

  const totalSubmissions = existing.documents.length + existing.attestations.length;
  if (totalSubmissions > 0) {
    throw new AppError(
      400,
      `Cannot delete: ${totalSubmissions} provider(s) have submitted this requirement`,
    );
  }

  await prisma.categoryVettingRequirement.delete({ where: { id: requirementId } });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "requirement_deleted",
      targetType: "category_requirement",
      targetId: requirementId,
      metadata: { name: existing.name, categoryId: existing.categoryId },
    },
  });

  await publishEvent("catalog.category.requirements.updated", existing.categoryId, {
    categoryId: existing.categoryId,
    action: "deleted",
    requirementId,
    requirementName: existing.name,
  });

  return { id: requirementId, deletedAt: new Date() };
};

export const listQuestionsByCategory = async (categoryId: string) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError(404, "Category not found");

  return prisma.categoryQuestion.findMany({
    where: { categoryId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
};

export const createQuestion = async (
  categoryId: string,
  input: CreateQuestionInput,
  adminId: string,
) => {
  const category = await prisma.serviceCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new AppError(404, "Category not found");

  const question = await prisma.categoryQuestion.create({
    data: { categoryId, ...input },
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "question_created",
      targetType: "category_question",
      targetId: question.id,
      metadata: { categoryId, question: question.question, type: question.type },
    },
  });

  return question;
};

export const updateQuestion = async (
  questionId: string,
  input: UpdateQuestionInput,
  adminId: string,
) => {
  const existing = await prisma.categoryQuestion.findUnique({ where: { id: questionId } });
  if (!existing) throw new AppError(404, "Question not found");

  const question = await prisma.categoryQuestion.update({
    where: { id: questionId },
    data: input,
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "question_updated",
      targetType: "category_question",
      targetId: questionId,
      metadata: { fields: Object.keys(input) },
    },
  });

  return question;
};

export const deleteQuestion = async (questionId: string, adminId: string) => {
  const existing = await prisma.categoryQuestion.findUnique({
    where: { id: questionId },
    include: { attestations: { select: { id: true } } },
  });
  if (!existing) throw new AppError(404, "Question not found");

  if (existing.attestations.length > 0) {
    throw new AppError(
      400,
      `Cannot delete: ${existing.attestations.length} provider(s) have answered this question`,
    );
  }

  await prisma.categoryQuestion.delete({ where: { id: questionId } });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "question_deleted",
      targetType: "category_question",
      targetId: questionId,
      metadata: { question: existing.question, categoryId: existing.categoryId },
    },
  });

  return { id: questionId, deletedAt: new Date() };
};

export const checkRequirementCompleteness = async (
  providerId: string,
): Promise<{ complete: boolean; missing: string[] }> => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const providerServices = await prisma.providerService.findMany({
    where: { providerId, isActive: true },
    select: { service: { select: { categoryId: true } } },
  });
  const categoryIds = [...new Set(providerServices.map((ps) => ps.service.categoryId))];

  const requirements = await prisma.categoryVettingRequirement.findMany({
    where: { categoryId: { in: categoryIds }, isActive: true, isRequired: true },
  });

  const docs = await prisma.providerDocument.findMany({
    where: { providerId, requirementId: { not: null } },
  });
  const attestations = await prisma.providerAttestation.findMany({
    where: { providerId, requirementId: { not: null } },
  });

  const approvedDocs = new Set(
    docs.filter((d) => d.status === "approved").map((d) => d.requirementId),
  );
  const attestationAnswers = new Set(attestations.map((a) => a.requirementId));

  const missing: string[] = [];

  for (const req of requirements) {
    if (req.type === "document" || req.type === "certification") {
      if (!approvedDocs.has(req.id)) {
        missing.push(req.name);
      }
    } else if (req.type === "attestation") {
      if (!attestationAnswers.has(req.id)) {
        missing.push(req.name);
      }
    }
  }

  return { complete: missing.length === 0, missing };
};

export const getProviderChecklist = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const providerServices = await prisma.providerService.findMany({
    where: { providerId, isActive: true },
    include: { service: { include: { category: true } } },
  });

  const categoryIds = [...new Set(providerServices.map((ps) => ps.service.categoryId))];
  const categoryMap = new Map(
    providerServices.map((ps) => [ps.service.categoryId, ps.service.category.name]),
  );

  const universalDocs = await prisma.providerDocument.findMany({
    where: { providerId, category: { in: ["selfie", "ghana_card"] } },
  });

  const requirements = await prisma.categoryVettingRequirement.findMany({
    where: { categoryId: { in: categoryIds }, isActive: true },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  const requirementDocs = await prisma.providerDocument.findMany({
    where: { providerId, requirementId: { not: null } },
  });

  const attestations = await prisma.providerAttestation.findMany({
    where: { providerId },
  });

  const docByReqId = new Map(requirementDocs.map((d) => [d.requirementId, d]));
  const attByReqId = new Map(
    attestations.filter((a) => a.requirementId).map((a) => [a.requirementId, a]),
  );
  const attByQId = new Map(
    attestations.filter((a) => a.questionId).map((a) => [a.questionId, a]),
  );

  const questions = await prisma.categoryQuestion.findMany({
    where: { categoryId: { in: categoryIds }, isActive: true },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  const groupedReqs = new Map<string, Array<Record<string, unknown>>>();
  for (const req of requirements) {
    const catName = categoryMap.get(req.categoryId) || "Unknown";
    if (!groupedReqs.has(catName)) groupedReqs.set(catName, []);

    const doc = docByReqId.get(req.id);
    const att = attByReqId.get(req.id);

    let status = "not_submitted";
    let detail: Record<string, unknown> = {};

    if (req.type === "attestation") {
      if (att) {
        status = "submitted";
        detail = { answer: att.answer, attestationId: att.id };
      }
    } else {
      if (doc) {
        status = doc.status;
        detail = {
          documentId: doc.id,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          rejectionReason: doc.rejectionReason,
        };
      }
    }

    groupedReqs.get(catName)!.push({
      id: req.id,
      type: req.type,
      name: req.name,
      description: req.description,
      isRequired: req.isRequired,
      status,
      ...detail,
    });
  }

  const groupedQs = new Map<string, Array<Record<string, unknown>>>();
  for (const q of questions) {
    const catName = categoryMap.get(q.categoryId) || "Unknown";
    if (!groupedQs.has(catName)) groupedQs.set(catName, []);

    const ans = attByQId.get(q.id);
    groupedQs.get(catName)!.push({
      id: q.id,
      question: q.question,
      type: q.type,
      options: q.options,
      isRequired: q.isRequired,
      answer: ans?.answer || null,
    });
  }

  return {
    universalDocs: universalDocs.map((d) => ({
      category: d.category,
      status: d.status,
      documentId: d.id,
      fileName: d.fileName,
      mimeType: d.mimeType,
      rejectionReason: d.rejectionReason,
    })),
    requirements: Object.fromEntries(groupedReqs),
    questions: Object.fromEntries(groupedQs),
  };
};

export const checkServiceCompleteness = async (
  providerId: string,
  providerServiceId: string,
): Promise<{ complete: boolean; missing: string[] }> => {
  const ps = await prisma.providerService.findUnique({
    where: { id: providerServiceId },
    include: { service: { include: { category: true } } },
  });
  if (!ps) throw new AppError(404, "Service offering not found");
  if (ps.providerId !== providerId) throw new AppError(403, "Service does not belong to this provider");

  const requirements = await prisma.categoryVettingRequirement.findMany({
    where: { categoryId: ps.service.categoryId, isActive: true, isRequired: true },
  });

  const docs = await prisma.providerDocument.findMany({
    where: { providerId, requirementId: { not: null } },
  });
  const attestations = await prisma.providerAttestation.findMany({
    where: { providerId, requirementId: { not: null } },
  });

  const approvedDocs = new Set(
    docs.filter((d) => d.status === "approved").map((d) => d.requirementId),
  );
  const attestationAnswers = new Set(attestations.map((a) => a.requirementId));

  const missing: string[] = [];

  for (const req of requirements) {
    if (req.type === "document" || req.type === "certification") {
      if (!approvedDocs.has(req.id)) missing.push(req.name);
    } else if (req.type === "attestation") {
      if (!attestationAnswers.has(req.id)) missing.push(req.name);
    }
  }

  return { complete: missing.length === 0, missing };
};

export const getServiceChecklist = async (providerId: string, providerServiceId: string) => {
  const ps = await prisma.providerService.findUnique({
    where: { id: providerServiceId },
    include: { service: { include: { category: true } } },
  });
  if (!ps) throw new AppError(404, "Service offering not found");
  if (ps.providerId !== providerId) throw new AppError(403, "Service does not belong to this provider");

  const profile = await prisma.providerProfile.findUnique({ where: { id: providerId } });
  if (!profile) throw new AppError(404, "Provider not found");

  const categoryId = ps.service.categoryId;
  const categoryName = ps.service.category.name;

  const requirements = await prisma.categoryVettingRequirement.findMany({
    where: { categoryId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const requirementDocs = await prisma.providerDocument.findMany({
    where: { providerId, requirementId: { not: null } },
  });
  const attestations = await prisma.providerAttestation.findMany({ where: { providerId } });

  const docByReqId = new Map(requirementDocs.map((d) => [d.requirementId, d]));
  const attByReqId = new Map(
    attestations.filter((a) => a.requirementId).map((a) => [a.requirementId, a]),
  );
  const attByQId = new Map(
    attestations.filter((a) => a.questionId).map((a) => [a.questionId, a]),
  );

  const questions = await prisma.categoryQuestion.findMany({
    where: { categoryId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const reqs = requirements.map((req) => {
    const doc = docByReqId.get(req.id);
    const att = attByReqId.get(req.id);

    let status = "not_submitted";
    let detail: Record<string, unknown> = {};

    if (req.type === "attestation") {
      if (att) {
        status = "submitted";
        detail = { answer: att.answer, attestationId: att.id };
      }
    } else if (doc) {
      status = doc.status;
      detail = {
        documentId: doc.id,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        rejectionReason: doc.rejectionReason,
      };
    }

    return {
      id: req.id,
      type: req.type,
      name: req.name,
      description: req.description,
      isRequired: req.isRequired,
      status,
      ...detail,
    };
  });

  const qs = questions.map((q) => {
    const ans = attByQId.get(q.id);
    return {
      id: q.id,
      question: q.question,
      type: q.type,
      options: q.options,
      isRequired: q.isRequired,
      answer: ans?.answer || null,
    };
  });

  return {
    serviceId: ps.serviceId,
    providerServiceId: ps.id,
    serviceName: ps.service.name,
    categoryName,
    status: ps.status,
    rejectionNote: ps.rejectionNote,
    identityApproved: profile.identityStatus === "approved",
    requirements: reqs,
    questions: qs,
  };
};
