import { Router } from "express";
import * as catalogController from "../controllers/catalog.controller";

const router = Router();

router.get("/categories", catalogController.listCategories);
router.get("/", catalogController.listServices);
router.get("/:slug", catalogController.getServiceBySlug);

export default router;
