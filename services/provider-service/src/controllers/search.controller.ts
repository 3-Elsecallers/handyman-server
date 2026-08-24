import { Request, Response, NextFunction } from "express";
import * as searchService from "../services/searchService";
import { searchProvidersSchema } from "../validation/searchValidation";

export const searchProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = searchProvidersSchema.parse(req.query);
    const result = await searchService.searchProviders(input);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const autocomplete = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = (req.query.q as string) || "";
    const result = await searchService.autocomplete(query);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
