import { Request, Response, NextFunction } from "express";
import * as addressService from "../services/addressService";
import { GHANA_REGIONS } from "../data/ghanaLocations";
import {
  createAddressSchema,
  updateAddressSchema,
} from "../validation/addressValidation";

export const listLocations = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: GHANA_REGIONS });
  } catch (error) {
    next(error);
  }
};

export const listAddresses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const addresses = await addressService.listAddresses(req.user!.id);
    res.json({ success: true, data: addresses });
  } catch (error) {
    next(error);
  }
};

export const createAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createAddressSchema.parse(req.body);
    const address = await addressService.createAddress(req.user!.id, input);
    res.status(201).json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

export const updateAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateAddressSchema.parse(req.body);
    const address = await addressService.updateAddress(
      req.user!.id,
      req.params.id as string,
      input,
    );
    res.json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
};

export const deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await addressService.deleteAddress(req.user!.id, req.params.id as string);
    res.json({ success: true, data: { message: "Address deleted" } });
  } catch (error) {
    next(error);
  }
};
