import { Router } from "express";
import * as favoriteController from "../controllers/favorite.controller";

const router = Router();

router.get("/", favoriteController.listFavorites);
router.post("/:providerId", favoriteController.addFavorite);
router.delete("/:providerId", favoriteController.removeFavorite);

export default router;
