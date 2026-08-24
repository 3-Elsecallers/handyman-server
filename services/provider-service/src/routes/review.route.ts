import { Router } from "express";
import * as reviewController from "../controllers/review.controller";

const router = Router();

router.post("/bookings/:id/review", reviewController.submitReview);
router.get("/providers/:id/reviews", reviewController.listReviews);
router.post("/reviews/:id/respond", reviewController.respondToReview);
router.post("/reviews/:id/flag", reviewController.flagReview);

export default router;
