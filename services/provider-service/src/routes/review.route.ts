import { Router } from "express";
import * as reviewController from "../controllers/review.controller";
import { authenticateFromHeaders } from "../middlewares/authenticate.middleware";

const router = Router();

router.post("/bookings/:id/review", authenticateFromHeaders, reviewController.submitReview);
router.get("/providers/:id/reviews", reviewController.listReviews);
router.post("/reviews/:id/respond", authenticateFromHeaders, reviewController.respondToReview);
router.post("/reviews/:id/flag", authenticateFromHeaders, reviewController.flagReview);

export default router;
