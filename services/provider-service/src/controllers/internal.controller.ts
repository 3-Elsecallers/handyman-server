import { Request, Response, NextFunction } from "express";
import * as providerService from "../services/providerService";
import * as catalogService from "../services/catalogService";
import * as availabilityService from "../services/availabilityService";
import { validateAvailabilitySchema, matchProvidersSchema } from "../validation/searchValidation";

export const getProviderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const provider = await providerService.getProviderById(req.params.id as string);
    res.json({ success: true, data: provider });
  } catch (error) {
    next(error);
  }
};

export const getProviderServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await providerService.getProviderServices(req.params.id as string);
    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
};

export const validateAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = validateAvailabilitySchema.parse(req.body);
    const result = await availabilityService.validateAvailability(
      req.params.id as string,
      input.scheduledAt,
      input.durationMins,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getServiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await catalogService.getServiceById(req.params.id as string);
    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};

export const listCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await catalogService.listCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};
