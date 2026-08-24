import { Request, Response, NextFunction } from "express";
import * as reviewService from "../services/reviewService";
import { submitReviewSchema, respondToReviewSchema } from "../validation/searchValidation";

export const submitReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = submitReviewSchema.parse(req.body);
    const { providerId } = req.params;
    const bookingId = req.body.bookingId || req.params.id;

    const review = await reviewService.submitReview(
      bookingId,
      req.user!.id,
      providerId as string,
      input.rating,
      input.comment,
      input.photoUrls,
    );
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

export const listReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await reviewService.listReviews(req.params.id as string, page, limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const respondToReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = respondToReviewSchema.parse(req.body);
    const review = await reviewService.respondToReview(
      req.user!.id,
      req.params.id as string,
      input.response,
    );
    res.json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};

export const flagReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await reviewService.flagReview(req.params.id as string);
    res.json({ success: true, data: review });
  } catch (error) {
    next(error);
  }
};
