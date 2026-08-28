import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import { authenticateFromHeaders, requireRole } from "../middlewares/authenticate.middleware";

const router = Router();

router.use(authenticateFromHeaders);
router.use(requireRole("admin"));

router.get("/providers", adminController.listAllProviders);
router.get("/providers/verify", adminController.getVerificationQueue);
router.get("/providers/verify/count", adminController.getVerificationQueueCount);
router.get("/providers/:id", adminController.getProviderDetail);
router.put("/providers/:id/verify", adminController.verifyProvider);
router.get("/providers/:id/documents", adminController.getProviderDocuments);
router.get("/providers/:id/reviews", adminController.getProviderReviews);
router.get("/documents/:documentId/download-url", adminController.getDocumentDownloadUrl);
router.get("/documents/:documentId/file", adminController.streamDocument);
router.post("/services/categories", adminController.createCategory);
router.put("/services/categories/:id", adminController.updateCategory);
router.delete("/services/categories/:id", adminController.deleteCategory);
router.post("/services", adminController.createService);
router.put("/services/:id", adminController.updateService);
router.delete("/services/:id", adminController.deleteService);
router.get("/reviews/moderation", adminController.getFlaggedReviews);
router.put("/reviews/:id/moderate", adminController.moderateReview);
router.get("/audit-log", adminController.getAuditLog);

export default router;
