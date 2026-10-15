import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { uploadMiddleware } from "../middlewares/upload.middleware";
import * as adminController from "../controllers/admin.controller";

const router = Router();

router.use(authMiddleware, adminMiddleware);

router.get("/stats", adminController.stats);
router.get("/products", adminController.listProducts);
router.post("/products", adminController.createProduct);
router.patch("/products/:id", adminController.updateProduct);
router.delete("/products/:id", adminController.deleteProduct);
router.post("/products/:id/image", uploadMiddleware.single("image"), adminController.uploadProductImage);
router.get("/orders", adminController.listOrders);
router.patch("/orders/:id", adminController.updateOrder);

export default router;
