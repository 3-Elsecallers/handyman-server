import { Request, Response, NextFunction } from "express";
import * as favoriteService from "../services/favoriteService";

export const listFavorites = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const favorites = await favoriteService.listFavorites(req.user!.id);
    res.json({ success: true, data: favorites });
  } catch (error) {
    next(error);
  }
};

export const addFavorite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const favorite = await favoriteService.addFavorite(
      req.user!.id,
      req.params.providerId as string,
    );
    res.status(201).json({ success: true, data: favorite });
  } catch (error) {
    next(error);
  }
};

export const removeFavorite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await favoriteService.removeFavorite(req.user!.id, req.params.providerId as string);
    res.json({ success: true, data: { message: "Favorite removed" } });
  } catch (error) {
    next(error);
  }
};
