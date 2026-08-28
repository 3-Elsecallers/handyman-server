import { Request, Response, NextFunction } from "express";
import * as bookingService from "../services/bookingService";

export const getBookingById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.getBookingById(req.params.id as string);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const getBookingsByCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await bookingService.listCustomerBookingsByUserId(req.params.id as string);
    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};

export const getBookingsByProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookings = await bookingService.listProviderBookingsByUserId(req.params.id as string);
    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
};
