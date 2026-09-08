import { Router } from "express";
import * as adminController from "../controllers/admin.controller";
import * as vettingController from "../controllers/vetting.controller";
import { authenticateFromHeaders, requireRole } from "../middlewares/authenticate.middleware";

const router = Router();

router.use(authenticateFromHeaders);
router.use(requireRole("admin"));

router.get("/providers", adminController.listAllProviders);
router.get("/providers/verify", adminController.getVerificationQueue);
router.get("/providers/verify/count", adminController.getVerificationQueueCount);
router.get("/providers/:id", adminController.getProviderDetail);
router.get("/providers/:id/identity", adminController.getProviderIdentity);
router.put("/providers/:id/identity/verify", adminController.reviewIdentity);
router.get("/providers/:id/services", adminController.getProviderServicesAdmin);
router.get("/providers/:id/services/:serviceId/checklist", adminController.getProviderServiceChecklist);
router.put("/providers/:id/services/:serviceId/verify", adminController.reviewProviderService);
router.put("/providers/:id/verify", adminController.verifyProvider);
router.get("/providers/:id/requirements", adminController.getProviderRequirements);
router.get("/providers/:id/documents", adminController.getProviderDocuments);
router.get("/quality/providers", adminController.listProviderQuality);
router.get("/providers/:id/quality", adminController.getProviderQuality);
router.post("/providers/:id/quality/recalculate", adminController.recalculateProviderQuality);
router.put("/quality/flags/:flagId/resolve", adminController.resolveQualityFlag);
router.get("/providers/:id/reviews", adminController.getProviderReviews);
router.get("/documents/:documentId/download-url", adminController.getDocumentDownloadUrl);
router.get("/documents/:documentId/file", adminController.streamDocument);
router.put("/documents/:documentId/review", adminController.reviewDocument);
router.post("/services/categories", adminController.createCategory);
router.put("/services/categories/:id", adminController.updateCategory);
router.delete("/services/categories/:id", adminController.deleteCategory);
router.post("/services", adminController.createService);
router.put("/services/:id", adminController.updateService);
router.delete("/services/:id", adminController.deleteService);
router.get("/services/categories/:id/requirements", vettingController.listRequirements);
router.post("/services/categories/:id/requirements", vettingController.createRequirement);
router.put("/requirements/:id", vettingController.updateRequirement);
router.delete("/requirements/:id", vettingController.deleteRequirement);
router.get("/services/categories/:id/questions", vettingController.listQuestions);
router.post("/services/categories/:id/questions", vettingController.createQuestion);
router.put("/questions/:id", vettingController.updateQuestion);
router.delete("/questions/:id", vettingController.deleteQuestion);
router.get("/reviews/moderation", adminController.getFlaggedReviews);
router.put("/reviews/:id/moderate", adminController.moderateReview);
router.get("/audit-log", adminController.getAuditLog);

export default router;
