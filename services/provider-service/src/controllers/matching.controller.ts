import { Request, Response, NextFunction } from "express";
import * as matchingService from "../services/matchingService";
import { matchProvidersSchema } from "../validation/searchValidation";

export const findMatchingProviders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = matchProvidersSchema.parse(req.body);
    const matches = await matchingService.findMatchingProviders(input);
    res.json({ success: true, data: { matches } });
  } catch (error) {
    next(error);
  }
};
