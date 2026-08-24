import { Router } from "express";
import * as matchingController from "../controllers/matching.controller";

const router = Router();

router.post("/find", matchingController.findMatchingProviders);

export default router;
