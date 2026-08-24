import { Request, Response, NextFunction } from "express";
import * as providerService from "../services/providerService";
import { updateProfileSchema, addServiceSchema, updateServiceSchema } from "../validation/providerValidation";

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
