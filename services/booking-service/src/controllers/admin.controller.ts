import { Request, Response, NextFunction } from "express";
import * as bookingService from "../services/bookingService";
import * as promoService from "../services/promoService";
import {
  adminListBookingsQuerySchema,
  resolveDisputeSchema,
} from "../validation/bookingValidation";
import {
  createPromoSchema,
  updatePromoSchema,
  listPromosQuerySchema,
} from "../validation/promoValidation";

export const listAllBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = adminListBookingsQuerySchema.parse(req.query);
    const result = await bookingService.listAllBookings(query);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const getBookingDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id as string);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const resolveDispute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = resolveDisputeSchema.parse(req.body);
    const booking = await bookingService.resolveDispute(
      req.params.id as string,
      req.user!.id,
      input,
    );
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const listPromos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listPromosQuerySchema.parse(req.query);
    const result = await promoService.listPromos(query.page, query.limit);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createPromo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createPromoSchema.parse(req.body);
    const promo = await promoService.createPromo(input);
    res.status(201).json({ success: true, data: promo });
  } catch (error) {
    next(error);
  }
};

export const updatePromo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updatePromoSchema.parse(req.body);
    const promo = await promoService.updatePromo(req.params.id as string, input);
    res.json({ success: true, data: promo });
  } catch (error) {
    next(error);
  }
};

export const deletePromo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await promoService.deletePromo(req.params.id as string);
    res.json({ success: true, data: { message: "Promo code deleted" } });
  } catch (error) {
    next(error);
  }
};
