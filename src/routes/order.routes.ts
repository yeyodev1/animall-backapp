import { Router } from "express";
import * as orderController from "../controllers/order.controller";

const router = Router();

router.post("/", orderController.create);

export default router;
