import { Request, Response, NextFunction } from "express";
import * as availabilityService from "../services/availabilityService";
import { updateAvailabilitySchema, createBlockedSlotSchema } from "../validation/availabilityValidation";

export const getAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slots = await availabilityService.getAvailability(req.user!.id);
    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

export const updateAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateAvailabilitySchema.parse(req.body);
    const slots = await availabilityService.updateAvailability(req.user!.id, input);
    res.json({ success: true, data: slots });
  } catch (error) {
    next(error);
  }
};

export const addBlockedSlot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createBlockedSlotSchema.parse(req.body);
    const slot = await availabilityService.addBlockedSlot(req.user!.id, input);
    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    next(error);
  }
};

export const removeBlockedSlot = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await availabilityService.removeBlockedSlot(req.user!.id, req.params.slotId as string);
    res.json({ success: true, data: { message: "Blocked slot removed" } });
  } catch (error) {
    next(error);
  }
};
