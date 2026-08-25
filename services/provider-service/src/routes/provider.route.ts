import { Router } from "express";
import * as providerController from "../controllers/provider.controller";

const router = Router();

router.get("/", providerController.getMyProfile);
router.put("/", providerController.updateMyProfile);
router.post("/documents", providerController.uploadDocuments);
router.post("/documents/request-urls", providerController.requestUploadUrls);
router.post("/documents/confirm", providerController.confirmUploads);
router.get("/documents", providerController.getMyDocuments);
router.get("/documents/:documentId/download-url", providerController.getDocumentDownloadUrl);
router.get("/services", providerController.getMyProfile);
router.post("/services", providerController.addService);
router.put("/services/:serviceId", providerController.updateMyService);
router.delete("/services/:serviceId", providerController.removeMyService);
router.get("/dashboard", providerController.getDashboard);

export default router;
