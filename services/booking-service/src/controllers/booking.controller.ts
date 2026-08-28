import { Request, Response, NextFunction } from "express";
import * as bookingService from "../services/bookingService";
import {
  instantBookingSchema,
  requestBookingSchema,
  cancelBookingSchema,
  disputeBookingSchema,
  listBookingsQuerySchema,
  estimateBookingSchema,
} from "../validation/bookingValidation";

export const createBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("here")
    const isRequest = req.body?.type === "request";
    let booking;
    if (isRequest) {
      const input = requestBookingSchema.parse(req.body);
      booking = await bookingService.createRequestBooking(req.user!.id, input);
    } else {
      const input = instantBookingSchema.parse(req.body);
      booking = await bookingService.createInstantBooking(req.user!.id, input);
    }

    res.status(201).json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const getBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.getBookingDetail(req.params.id as string, req.user!);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = cancelBookingSchema.parse(req.body);
    const booking = await bookingService.cancelBooking(
      req.params.id as string,
      req.user!,
      input.reason,
    );
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const disputeBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = disputeBookingSchema.parse(req.body);
    const booking = await bookingService.disputeBooking(req.params.id as string, req.user!.id, input);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const getTimeline = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const timeline = await bookingService.getTimeline(req.params.id as string, req.user!);
    res.json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
};

export const listCustomerBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listBookingsQuerySchema.parse(req.query);
    const result = await bookingService.listCustomerBookings(req.user!.id, query);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const listProviderBookings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listBookingsQuerySchema.parse(req.query);
    const result = await bookingService.listProviderBookings(req.user!.id, query);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const confirmBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.confirmBooking(req.params.id as string, req.user!.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const declineBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.declineBooking(req.params.id as string, req.user!.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const startBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.startBooking(req.params.id as string, req.user!.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const completeBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.completeBooking(req.params.id as string, req.user!.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const reassignBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booking = await bookingService.reassignBooking(req.params.id as string, req.user!.id);
    res.json({ success: true, data: booking });
  } catch (error) {
    next(error);
  }
};

export const estimateBooking = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = estimateBookingSchema.parse(req.body);
    const estimate = await bookingService.getBookingEstimate(req.user!.id, input);
    res.json({ success: true, data: estimate });
  } catch (error) {
    next(error);
  }
};

export const getBookingProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await bookingService.getBookingProviderInfo(req.params.id as string, req.user!.id);
    res.json({ success: true, data: info });
  } catch (error) {
    next(error);
  }
};
