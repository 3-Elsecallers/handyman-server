import { prisma } from "../db/prisma";
import { AppError } from "../middlewares/errorHandler.middleware";
import { publishEvent } from "../utils/kafka";
import {
  buildS3Key,
  generateUploadUrl,
  generateDownloadUrl,
  getObjectContentLength,
  getDocumentStream,
  extFromMime,
} from "../config/s3";
import type {
  UpdateProfileInput,
  AddServiceInput,
  RequestUploadUrlsInput,
  SubmitAttestationsInput,
} from "../validation/providerValidation";

export const getOrCreateProfile = async (userId: string) => {
  let profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) {
    profile = await prisma.providerProfile.create({
      data: { userId },
    });
  }
  return profile;
};

export const getMyProfile = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    include: {
      services: { include: { service: true } },
    },
  });
  if (!profile) throw new AppError(404, "Provider profile not found");
  return profile;
};

export const getPublicProfile = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: {
      services: {
        where: { isActive: true },
        include: { service: true },
      },
    },
  });
  if (!profile) throw new AppError(404, "Provider not found");
  return profile;
};

export const updateProfile = async (userId: string, input: UpdateProfileInput) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const updated = await prisma.providerProfile.update({
    where: { id: profile.id },
    data: input,
  });

  await publishEvent("provider.profile.updated", profile.id, {
    providerId: profile.id,
    fields: Object.keys(input),
  });

  return updated;
};

const IDENTITY_CATEGORIES = ["selfie", "ghana_card", "additional"];

const includesIdentityCategory = (category: string) =>
  IDENTITY_CATEGORIES.includes(category);

export const addService = async (userId: string, input: AddServiceInput) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
  if (!service) throw new AppError(404, "Service not found");

  const existing = await prisma.providerService.findUnique({
    where: { providerId_serviceId: { providerId: profile.id, serviceId: input.serviceId } },
  });
  if (existing) throw new AppError(409, "Service already added");

  const complete = await checkServiceCompletenessInternal(profile.id, service.categoryId);

  const status: "not_submitted" | "pending_review" | "approved" =
    complete ? "approved" : "not_submitted";

  const identityApproved = profile.identityStatus === "approved";
  const isActive = identityApproved && status === "approved";

  const ps = await prisma.providerService.create({
    data: {
      providerId: profile.id,
      serviceId: input.serviceId,
      customPrice: input.customPrice,
      isActive,
      status,
    },
    include: { service: true },
  });

  if (isActive) {
    await recomputeProviderVerificationStatus(profile.id);
  }

  return {
    ...ps,
    missingRequirements: complete ? undefined : ["Complete service requirements and submit for review"],
  };
};

const checkServiceCompletenessInternal = async (
  providerId: string,
  categoryId: string,
): Promise<boolean> => {
  const requirements = await prisma.categoryVettingRequirement.findMany({
    where: { categoryId, isActive: true, isRequired: true },
  });

  if (requirements.length === 0) return true;

  const approvedDocs = new Set(
    (await prisma.providerDocument.findMany({
      where: { providerId, requirementId: { not: null }, status: "approved" },
    })).filter((d) => d.requirementId).map((d) => d.requirementId),
  );
  const answeredReqIds = new Set(
    (await prisma.providerAttestation.findMany({
      where: { providerId, requirementId: { not: null } },
    })).map((a) => a.requirementId),
  );

  for (const req of requirements) {
    if (req.type === "document" || req.type === "certification") {
      if (!approvedDocs.has(req.id)) return false;
    } else if (req.type === "attestation") {
      if (!answeredReqIds.has(req.id)) return false;
    }
  }

  return true;
};

export const updateMyService = async (
  userId: string,
  providerServiceId: string,
  input: { customPrice?: number; isActive?: boolean },
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const ps = await prisma.providerService.findFirst({
    where: { id: providerServiceId, providerId: profile.id },
  });
  if (!ps) throw new AppError(404, "Service offering not found");

  if (input.isActive === true) {
    if (profile.identityStatus !== "approved") {
      throw new AppError(
        400,
        "This service cannot be activated until your identity verification is approved.",
      );
    }
    if (ps.status !== "approved") {
      throw new AppError(
        400,
        "This service cannot be activated until its verification is approved by an admin.",
      );
    }
  }

  return prisma.providerService.update({
    where: { id: providerServiceId },
    data: input,
    include: { service: true },
  });
};

export const removeMyService = async (userId: string, providerServiceId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const ps = await prisma.providerService.findFirst({
    where: { id: providerServiceId, providerId: profile.id },
  });
  if (!ps) throw new AppError(404, "Service offering not found");

  await prisma.providerService.delete({ where: { id: providerServiceId } });
};

export const getDashboard = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const recentReviews = await prisma.review.findMany({
    where: { providerId: profile.id, status: "visible" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      rating: true,
      comment: true,
      customerId: true,
      createdAt: true,
    },
  });

  return {
    stats: {
      avgRating: profile.avgRating,
      totalReviews: profile.totalReviews,
      totalJobs: profile.totalJobs,
      completionRate: profile.completionRate,
      avgResponseTimeMins: profile.avgResponseTimeMins,
      verified: profile.verified,
      status: profile.status,
    },
    recentReviews,
  };
};

export const getProviderById = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
  });
  if (!profile) throw new AppError(404, "Provider not found");
  return profile;
};

export const getProviderServices = async (providerId: string) => {
  return prisma.providerService.findMany({
    where: { providerId, isActive: true },
    include: { service: true },
  });
};

export const verifyProviderServiceBookable = async (
  providerId: string,
  serviceId: string,
): Promise<{ bookable: boolean; reason?: string }> => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
  });
  if (!profile) {
    return { bookable: false, reason: "Provider not found" };
  }
  if (profile.status !== "active") {
    return { bookable: false, reason: "Provider is not active" };
  }
  if (profile.identityStatus !== "approved") {
    return { bookable: false, reason: "Provider identity is not approved" };
  }

  const providerService = await prisma.providerService.findFirst({
    where: { providerId, serviceId },
  });
  if (!providerService) {
    return { bookable: false, reason: "Provider does not offer this service" };
  }
  if (!providerService.isActive || providerService.status !== "approved") {
    return { bookable: false, reason: "This service is not approved for booking" };
  }
  return { bookable: true };
};


export const requestDocumentUploadUrls = async (
  userId: string,
  input: RequestUploadUrlsInput,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const providerCategoryIds = await prisma.providerService.findMany({
    where: { providerId: profile.id },
    select: { service: { select: { categoryId: true } } },
  });
  const allowedCategoryIds = new Set(providerCategoryIds.map((ps) => ps.service.categoryId));

  const results: Array<{
    id: string;
    uploadUrl: string;
    s3Key: string;
    category: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }> = [];

  for (const file of input.files) {
    let requirementId: string | null = null;
    let maxFileSizeMb = 10;
    let acceptedMimeTypes: string[] = [];

    if (file.requirementId) {
      const req = await prisma.categoryVettingRequirement.findUnique({
        where: { id: file.requirementId },
      });
      if (!req) throw new AppError(404, `Requirement not found: ${file.requirementId}`);
      if (!allowedCategoryIds.has(req.categoryId)) {
        throw new AppError(403, "This requirement does not apply to your service categories");
      }
      requirementId = req.id;
      maxFileSizeMb = req.maxFileSizeMb;
      acceptedMimeTypes = req.acceptedMimeTypes;
    }

    if (acceptedMimeTypes.length > 0 && !acceptedMimeTypes.includes(file.mimeType)) {
      throw new AppError(
        400,
        `File type not accepted. Accepted types: ${acceptedMimeTypes.join(", ")}`,
      );
    }

    const maxBytes = maxFileSizeMb * 1024 * 1024;
    if (file.fileSize > maxBytes) {
      throw new AppError(
        400,
        `File size exceeds the maximum allowed size of ${maxFileSizeMb} MB for this requirement`,
      );
    }

    const ext = extFromMime(file.mimeType);
    const s3Key = buildS3Key(profile.id, file.category, ext);
    const uploadUrl = await generateUploadUrl(s3Key, file.mimeType);

    const doc = await prisma.providerDocument.create({
      data: {
        providerId: profile.id,
        category: file.category,
        requirementId,
        s3Key,
        fileName: file.fileName,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        status: "uploaded",
      },
    });

    results.push({
      id: doc.id,
      uploadUrl,
      s3Key,
      category: file.category,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: file.mimeType,
    });
  }

  return results;
};

export const confirmDocumentUploads = async (
  userId: string,
  documentIds: string[],
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const docs = await prisma.providerDocument.findMany({
    where: {
      id: { in: documentIds },
      providerId: profile.id,
    },
  });

  if (docs.length !== documentIds.length) {
    throw new AppError(400, "One or more document IDs are invalid");
  }

  for (const doc of docs) {
    const storedSize = await getObjectContentLength(doc.s3Key);
    if (storedSize === 0) {
      throw new AppError(
        400,
        `File "${doc.fileName}" is empty in storage. Please upload the file again.`,
      );
    }
  }

  await prisma.providerDocument.updateMany({
    where: { id: { in: documentIds } },
    data: { status: "pending_review" },
  });

  const hasIdentityDocs = docs.some((d) => includesIdentityCategory(d.category));

  if (hasIdentityDocs) {
    await prisma.providerProfile.update({
      where: { id: profile.id },
      data: {
        identityStatus: "pending_review",
        identityRejectionNote: null,
      },
    });
  }

  await recomputeProviderVerificationStatus(profile.id);

  await publishEvent("provider.documents.submitted", profile.id, {
    providerId: profile.id,
    documentIds,
  });

  return { message: "Documents submitted for review" };
};

export const getMyDocuments = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  return prisma.providerDocument.findMany({
    where: { providerId: profile.id },
    orderBy: { createdAt: "desc" },
  });
};

export const getDocumentDownloadUrl = async (
  userId: string,
  documentId: string,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const doc = await prisma.providerDocument.findFirst({
    where: { id: documentId, providerId: profile.id },
  });
  if (!doc) throw new AppError(404, "Document not found");

  const url = await generateDownloadUrl(doc.s3Key);
  return { url, document: doc };
};

const TEST_IMAGE_EXT = "png";

export const getTestUploadUrl = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const key = `test-uploads/${profile.id}/image.${TEST_IMAGE_EXT}`;
  const uploadUrl = await generateUploadUrl(key, "image/"+TEST_IMAGE_EXT);
  return { uploadUrl, s3Key: key };
};

export const streamTestImage = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const key = `test-uploads/${profile.id}/image.${TEST_IMAGE_EXT}`;
  try {
    return { result: await getDocumentStream(key) };
  } catch {
    throw new AppError(404, "No uploaded image found. Please upload one first.");
  }
};

export const getMyRequirements = async (userId: string, serviceId?: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const providerServices = serviceId
    ? await prisma.providerService.findMany({
        where: { providerId: profile.id, id: serviceId },
        include: { service: { include: { category: true } } },
      })
    : await prisma.providerService.findMany({
        where: { providerId: profile.id },
        include: { service: { include: { category: true } } },
      });

  if (serviceId && providerServices.length === 0) {
    throw new AppError(404, "Service not found for this provider");
  }

  const categoryIds = [...new Set(providerServices.map((ps) => ps.service.categoryId))];

  const categoryMap = new Map(
    providerServices.map((ps) => [ps.service.categoryId, ps.service.category.name]),
  );

  const requirements = await prisma.categoryVettingRequirement.findMany({
    where: { categoryId: { in: categoryIds }, isActive: true },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  const providerDocs = await prisma.providerDocument.findMany({
    where: { providerId: profile.id },
  });

  const providerAttestations = await prisma.providerAttestation.findMany({
    where: { providerId: profile.id },
  });

  const attestationMap = new Map(providerAttestations.map((a) => [a.requirementId, a]));

  const enriched = requirements.map((req) => {
    const doc = providerDocs.find((d) => d.requirementId === req.id);
    const att = attestationMap.get(req.id);

    if (req.type === "attestation") {
      return {
        id: req.id,
        categoryId: req.categoryId,
        categoryName: categoryMap.get(req.categoryId) || "",
        type: req.type,
        name: req.name,
        description: req.description,
        isRequired: req.isRequired,
        acceptedMimeTypes: req.acceptedMimeTypes,
        maxFileSizeMb: req.maxFileSizeMb,
        sortOrder: req.sortOrder,
        submissionStatus: att ? "submitted" : null,
        answer: att?.answer || null,
        attestationId: att?.id || null,
      };
    }

    return {
      id: req.id,
      categoryId: req.categoryId,
      categoryName: categoryMap.get(req.categoryId) || "",
      type: req.type,
      name: req.name,
      description: req.description,
      isRequired: req.isRequired,
      acceptedMimeTypes: req.acceptedMimeTypes,
      maxFileSizeMb: req.maxFileSizeMb,
      sortOrder: req.sortOrder,
      submissionStatus: doc?.status || null,
      documentId: doc?.id || null,
      mimeType: doc?.mimeType || null,
      fileName: doc?.fileName || null,
      rejectionReason: doc?.rejectionReason || null,
    };
  });

  return {
    requirements: enriched,
    providerVerificationStatus: profile.verificationStatus,
    identityStatus: profile.identityStatus,
  };
};

export const getMyQuestions = async (userId: string, serviceId?: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const providerServices = serviceId
    ? await prisma.providerService.findMany({
        where: { providerId: profile.id, id: serviceId },
        include: { service: { include: { category: true } } },
      })
    : await prisma.providerService.findMany({
        where: { providerId: profile.id },
        include: { service: { include: { category: true } } },
      });

  if (serviceId && providerServices.length === 0) {
    throw new AppError(404, "Service not found for this provider");
  }

  const categoryIds = [...new Set(providerServices.map((ps) => ps.service.categoryId))];

  const categoryMap = new Map(
    providerServices.map((ps) => [ps.service.categoryId, ps.service.category.name]),
  );

  const questions = await prisma.categoryQuestion.findMany({
    where: { categoryId: { in: categoryIds }, isActive: true },
    orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }],
  });

  const providerAttestations = await prisma.providerAttestation.findMany({
    where: { providerId: profile.id, questionId: { not: null } },
  });

  const answerMap = new Map(providerAttestations.map((a) => [a.questionId, a]));

  const enriched = questions.map((q) => {
    const ans = answerMap.get(q.id);
    return {
      id: q.id,
      categoryId: q.categoryId,
      categoryName: categoryMap.get(q.categoryId) || "",
      question: q.question,
      type: q.type,
      options: q.options,
      isRequired: q.isRequired,
      sortOrder: q.sortOrder,
      answer: ans?.answer || null,
      answerId: ans?.id || null,
    };
  });

  return { questions: enriched };
};

export const submitAttestations = async (
  userId: string,
  input: SubmitAttestationsInput,
  serviceId?: string,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const providerServiceCategoryIds = await prisma.providerService.findMany({
    where: { providerId: profile.id },
    include: { service: { select: { categoryId: true } } },
  });
  const allowedCategoryIds = new Set(
    providerServiceCategoryIds.map((ps) => ps.service.categoryId),
  );

  let serviceCategoryId: string | null = null;
  let targetServiceId: string | null = null;
  if (serviceId) {
    const ps = await prisma.providerService.findFirst({
      where: { id: serviceId, providerId: profile.id },
      include: { service: { select: { categoryId: true } } },
    });
    if (!ps) throw new AppError(404, "Service not found for this provider");
    serviceCategoryId = ps.service.categoryId;
    targetServiceId = ps.id;
  }

  for (const att of input.attestations) {
    const req = await prisma.categoryVettingRequirement.findUnique({
      where: { id: att.requirementId },
    });
    if (!req) throw new AppError(404, `Requirement not found: ${att.requirementId}`);
    if (!allowedCategoryIds.has(req.categoryId)) {
      throw new AppError(403, "This requirement does not apply to your service categories");
    }
    if (serviceCategoryId && req.categoryId !== serviceCategoryId) {
      throw new AppError(400, "This requirement does not belong to the selected service's category");
    }
    if (req.type !== "attestation") {
      throw new AppError(400, "Only attestation-type requirements can be answered here");
    }
  }

  for (const q of input.questions) {
    const question = await prisma.categoryQuestion.findUnique({ where: { id: q.questionId } });
    if (!question) throw new AppError(404, `Question not found: ${q.questionId}`);
    if (!allowedCategoryIds.has(question.categoryId)) {
      throw new AppError(403, "This question does not apply to your service categories");
    }
    if (serviceCategoryId && question.categoryId !== serviceCategoryId) {
      throw new AppError(400, "This question does not belong to the selected service's category");
    }
  }

  const results: Array<{ id: string; type: string }> = [];

  for (const att of input.attestations) {
    const existing = await prisma.providerAttestation.findUnique({
      where: { providerId_requirementId: { providerId: profile.id, requirementId: att.requirementId } },
    });

    if (existing) {
      const updated = await prisma.providerAttestation.update({
        where: { id: existing.id },
        data: { answer: att.answer, serviceId: targetServiceId ?? existing.serviceId },
      });
      results.push({ id: updated.id, type: "attestation" });
    } else {
      const created = await prisma.providerAttestation.create({
        data: {
          providerId: profile.id,
          serviceId: targetServiceId,
          requirementId: att.requirementId,
          answer: att.answer,
        },
      });
      results.push({ id: created.id, type: "attestation" });
    }
  }

  for (const q of input.questions) {
    const existing = await prisma.providerAttestation.findUnique({
      where: { providerId_questionId: { providerId: profile.id, questionId: q.questionId } },
    });

    if (existing) {
      const updated = await prisma.providerAttestation.update({
        where: { id: existing.id },
        data: { answer: q.answer, serviceId: targetServiceId ?? existing.serviceId },
      });
      results.push({ id: updated.id, type: "question" });
    } else {
      const created = await prisma.providerAttestation.create({
        data: {
          providerId: profile.id,
          serviceId: targetServiceId,
          questionId: q.questionId,
          answer: q.answer,
        },
      });
      results.push({ id: created.id, type: "question" });
    }
  }

  return { saved: results.length, results };
};

export const updateAttestation = async (
  userId: string,
  attestationId: string,
  answer: string,
) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const attestation = await prisma.providerAttestation.findUnique({
    where: { id: attestationId },
  });
  if (!attestation) throw new AppError(404, "Attestation not found");
  if (attestation.providerId !== profile.id) {
    throw new AppError(403, "Not your attestation");
  }

  return prisma.providerAttestation.update({
    where: { id: attestationId },
    data: { answer },
  });
};

export const getMyIdentity = async (userId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const identityDocs = await prisma.providerDocument.findMany({
    where: { providerId: profile.id, category: { in: IDENTITY_CATEGORIES } },
    orderBy: { createdAt: "asc" },
  });

  return {
    identityStatus: profile.identityStatus,
    identityVerified: profile.identityVerified,
    identityRejectionNote: profile.identityRejectionNote,
    documents: identityDocs,
  };
};

export const submitServiceForReview = async (userId: string, providerServiceId: string) => {
  const profile = await prisma.providerProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError(404, "Provider profile not found");

  const ps = await prisma.providerService.findFirst({
    where: { id: providerServiceId, providerId: profile.id },
    include: { service: { include: { category: true } } },
  });
  if (!ps) throw new AppError(404, "Service offering not found");

  const complete = await checkServiceCompletenessInternal(profile.id, ps.service.categoryId);
  if (!complete) {
    throw new AppError(
      400,
      "This service's requirements are incomplete. Complete all required items before submitting for review.",
    );
  }

  const updated = await prisma.providerService.update({
    where: { id: ps.id },
    data: {
      status: "pending_review",
      submittedAt: new Date(),
      rejectionNote: null,
    },
  });

  await recomputeProviderVerificationStatus(profile.id);

  await publishEvent("provider.service.submitted", profile.id, {
    providerId: profile.id,
    providerServiceId: ps.id,
    serviceId: ps.serviceId,
  });

  return updated;
};

export const recomputeProviderVerificationStatus = async (providerId: string) => {
  const profile = await prisma.providerProfile.findUnique({
    where: { id: providerId },
    include: { services: true },
  });
  if (!profile) throw new AppError(404, "Provider not found");

  let next: "not_submitted" | "pending_review" | "approved" | "rejected";

  if (profile.identityStatus === "rejected") {
    next = "rejected";
  } else if (
    profile.identityStatus === "approved" &&
    profile.services.length > 0 &&
    profile.services.some((s) => s.status === "approved")
  ) {
    next = "approved";
  } else if (
    profile.identityStatus === "pending_review" ||
    profile.services.some((s) => s.status === "pending_review")
  ) {
    next = "pending_review";
  } else {
    next = "not_submitted";
  }

  const data: {
    verificationStatus: typeof next;
    status?: "active";
    verified?: boolean;
  } = { verificationStatus: next };

  if (next === "approved") {
    data.verified = true;
    if (profile.status === "pending_review") {
      data.status = "active";
    }
  }

  await prisma.providerProfile.update({
    where: { id: providerId },
    data,
  });

  return next;
};
