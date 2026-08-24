import { Router } from "express";
import * as profileController from "../controllers/profile.controller";

const router = Router();

router.get("/me", profileController.getProfile);
router.put("/me", profileController.updateProfile);
router.post("/me/avatar", profileController.uploadAvatar);

export default router;
