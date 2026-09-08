import { Request, Response, NextFunction } from "express";
import * as adminService from "../services/adminService";
import * as reviewService from "../services/reviewService";
import * as qualityService from "../services/qualityService";

export const listProviderQuality = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await qualityService.listProviderQuality(
      {
        grade: req.query.grade as string | undefined,
        tier: req.query.tier as string | undefined,
        status: req.query.status as string | undefined,
        flagged: req.query.flagged === "true",
      },
      req.query.page ? parseInt(req.query.page as string) : 1,
      req.query.limit ? parseInt(req.query.limit as string) : 20,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProviderQuality = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await qualityService.getProviderQualityDetail(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const recalculateProviderQuality = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await qualityService.recalculateProvider(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const resolveQualityFlag = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await qualityService.resolveQualityFlag(req.params.flagId as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const listAllProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.listAllProviders({
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      verificationStatus: req.query.verificationStatus as string | undefined,
      identityStatus: req.query.identityStatus as string | undefined,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getVerificationQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminService.getVerificationQueue(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getVerificationQueueCount = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getVerificationQueueCount();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProviderDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getProviderDetail(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const verifyProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approved, rejectionNote, overrideReason } = req.body;
    if (typeof approved !== "boolean") {
      return res.status(400).json({ success: false, message: "approved boolean required" });
    }
    const result = await adminService.verifyProvider(
      req.params.id as string,
      approved,
      req.user!.id,
      rejectionNote,
      overrideReason,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProviderDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getProviderDocuments(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getDocumentDownloadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getDocumentDownloadUrl(req.params.documentId as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const streamDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { doc, result } = await adminService.streamDocument(req.params.documentId as string);

    res.setHeader("Content-Type", doc.mimeType || "application/octet-stream");
    if (result.ContentLength !== undefined) {
      res.setHeader("Content-Length", String(result.ContentLength));
    }
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(doc.fileName || "document")}"`,
    );
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    const body = result.Body as unknown as NodeJS.ReadableStream | undefined;
    if (!body) {
      return res.status(404).json({ success: false, message: "File not found in storage" });
    }

    (body as NodeJS.ReadableStream).pipe(res);
  } catch (error) {
    next(error);
  }
};

export const getProviderReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminService.getProviderReviews(req.params.id as string, page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.createCategory(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.updateCategory(
      req.params.id as string,
      req.body,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.deleteCategory(
      req.params.id as string,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.createService(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.updateService(
      req.params.id as string,
      req.body,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.deleteService(
      req.params.id as string,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getFlaggedReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await reviewService.getFlaggedReviews(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const moderateReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!["visible", "flagged", "removed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }
    const result = await reviewService.moderateReview(req.params.id as string, status);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getAuditLog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await adminService.getAuditLog(page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProviderRequirements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getProviderRequirementChecklist(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const reviewDocument = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approved, rejectionReason } = req.body;
    if (typeof approved !== "boolean") {
      return res.status(400).json({ success: false, message: "approved boolean required" });
    }
    const result = await adminService.reviewDocument(
      req.params.documentId as string,
      approved,
      req.user!.id,
      rejectionReason,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProviderIdentity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getProviderIdentity(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const reviewIdentity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approved, rejectionNote } = req.body;
    if (typeof approved !== "boolean") {
      return res.status(400).json({ success: false, message: "approved boolean required" });
    }
    const result = await adminService.reviewIdentity(
      req.params.id as string,
      approved,
      req.user!.id,
      rejectionNote,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProviderServicesAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getProviderServices(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getProviderServiceChecklist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await adminService.getProviderServiceChecklist(
      req.params.id as string,
      req.params.serviceId as string,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const reviewProviderService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { approved, rejectionNote } = req.body;
    if (typeof approved !== "boolean") {
      return res.status(400).json({ success: false, message: "approved boolean required" });
    }
    const result = await adminService.reviewService(
      req.params.id as string,
      req.params.serviceId as string,
      approved,
      req.user!.id,
      rejectionNote,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
