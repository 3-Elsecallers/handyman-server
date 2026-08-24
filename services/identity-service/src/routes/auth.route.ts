import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { authenticateFromHeaders } from "../middlewares/authenticate.middleware";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authenticateFromHeaders, authController.logout);
router.post("/logout-all", authenticateFromHeaders, authController.logoutAll);

export default router;
