import { Request, Response, NextFunction } from "express";
import * as catalogService from "../services/catalogService";

export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await catalogService.listCategories(
      req.query.includeInactive === "true",
    );
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

export const listServices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await catalogService.listServices(
      req.query.categoryId as string | undefined,
      req.query.search as string | undefined,
      req.query.includeInactive === "true",
    );
    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
};

export const getServiceBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const service = await catalogService.getServiceBySlug(req.params.slug as string);
    res.json({ success: true, data: service });
  } catch (error) {
    next(error);
  }
};
