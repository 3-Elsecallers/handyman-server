import { Request, Response, NextFunction } from "express";
import * as providerService from "../services/providerService";
import {
  updateProfileSchema,
  addServiceSchema,
  updateServiceSchema,
  requestUploadUrlsSchema,
  confirmUploadsSchema,
} from "../validation/providerValidation";

export const getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await providerService.getMyProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const updateMyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateProfileSchema.parse(req.body);
    const profile = await providerService.updateProfile(req.user!.id, input);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const getPublicProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const profile = await providerService.getPublicProfile(req.params.id as string);
    res.json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

export const addService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = addServiceSchema.parse(req.body);
    const ps = await providerService.addService(req.user!.id, input);
    res.status(201).json({ success: true, data: ps });
  } catch (error) {
    next(error);
  }
};

export const updateMyService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateServiceSchema.parse(req.body);
    const ps = await providerService.updateMyService(
      req.user!.id,
      req.params.serviceId as string,
      input,
    );
    res.json({ success: true, data: ps });
  } catch (error) {
    next(error);
  }
};

export const removeMyService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await providerService.removeMyService(req.user!.id, req.params.serviceId as string);
    res.json({ success: true, data: { message: "Service removed" } });
  } catch (error) {
    next(error);
  }
};

export const getDashboard = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dashboard = await providerService.getDashboard(req.user!.id);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    next(error);
  }
};

export const uploadDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { documentUrls } = req.body;
    if (!Array.isArray(documentUrls) || documentUrls.length === 0) {
      return res.status(400).json({ success: false, message: "documentUrls array required" });
    }
    res.json({ success: true, data: { message: "Documents uploaded", urls: documentUrls } });
  } catch (error) {
    next(error);
  }
};

export const requestUploadUrls = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = requestUploadUrlsSchema.parse(req.body);
    const result = await providerService.requestDocumentUploadUrls(req.user!.id, input);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const confirmUploads = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = confirmUploadsSchema.parse(req.body);
    const result = await providerService.confirmDocumentUploads(req.user!.id, input.documents.map((d) => d.id));
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getMyDocuments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = await providerService.getMyDocuments(req.user!.id);
    res.json({ success: true, data: docs });
  } catch (error) {
    next(error);
  }
};

export const getDocumentDownloadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await providerService.getDocumentDownloadUrl(
      req.user!.id,
      req.params.documentId as string,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getTestUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await providerService.getTestUploadUrl(req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const streamTestImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { result } = await providerService.streamTestImage(req.user!.id);

    res.setHeader("Content-Type", "image/png");
    if (result.ContentLength !== undefined) {
      res.setHeader("Content-Length", String(result.ContentLength));
    }
    res.setHeader("Cache-Control", "private, max-age=60");

    const body = result.Body as unknown as NodeJS.ReadableStream | undefined;
    if (!body) {
      return res.status(404).json({ success: false, message: "Image not found in storage" });
    }

    (body as NodeJS.ReadableStream).pipe(res);
  } catch (error) {
    next(error);
  }
};
