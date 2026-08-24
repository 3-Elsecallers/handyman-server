import { Router } from "express";
import * as internalController from "../controllers/internal.controller";
import { serviceAuth } from "../middlewares/authenticate.middleware";

const router = Router();

router.use(serviceAuth);

router.get("/providers/:id", internalController.getProviderById);
router.get("/providers/:id/services", internalController.getProviderServices);
router.post("/providers/:id/availability/validate", internalController.validateAvailability);
router.get("/services/:id", internalController.getServiceById);
router.get("/services/categories", internalController.listCategories);

export default router;
