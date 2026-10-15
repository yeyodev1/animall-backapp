import { Router } from "express";
import * as productController from "../controllers/product.controller";

const router = Router();

router.get("/", productController.list);
router.get("/filters", productController.filters);
router.get("/featured", productController.featured);
router.get("/:slug", productController.getBySlug);

export default router;
