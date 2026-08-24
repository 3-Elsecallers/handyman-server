import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { authenticateFromHeaders, requireRole } from "../middlewares/authenticate.middleware";

const router = Router();

router.use(authenticateFromHeaders);
router.use(requireRole("admin"));

router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUserDetail);
router.put("/users/:id/status", adminController.updateUserStatus);

export default router;
