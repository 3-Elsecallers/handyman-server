import { Request, Response, NextFunction } from "express";
import * as vettingService from "../services/vettingService";
import {
  createRequirementSchema,
  updateRequirementSchema,
  createQuestionSchema,
  updateQuestionSchema,
} from "../validation/vettingValidation";

export const listRequirements = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vettingService.listRequirementsByCategory(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createRequirement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createRequirementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await vettingService.createRequirement(
      req.params.id as string,
      parsed.data,
      req.user!.id,
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateRequirement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateRequirementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await vettingService.updateRequirement(
      req.params.id as string,
      parsed.data,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteRequirement = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vettingService.deleteRequirement(req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const listQuestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vettingService.listQuestionsByCategory(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await vettingService.createQuestion(
      req.params.id as string,
      parsed.data,
      req.user!.id,
    );
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const updateQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = updateQuestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await vettingService.updateQuestion(
      req.params.id as string,
      parsed.data,
      req.user!.id,
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await vettingService.deleteQuestion(req.params.id as string, req.user!.id);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
