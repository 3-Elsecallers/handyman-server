import { Router } from "express";
import * as providerController from "../controllers/provider.controller";

const router = Router();

router.get("/", providerController.getMyProfile);
router.put("/", providerController.updateMyProfile);
router.post("/documents", providerController.uploadDocuments);
router.get("/services", providerController.getMyProfile);
router.post("/services", providerController.addService);
router.put("/services/:serviceId", providerController.updateMyService);
router.delete("/services/:serviceId", providerController.removeMyService);
router.get("/dashboard", providerController.getDashboard);

export default router;
