import { Response, NextFunction } from "express";
import { AuthRequest } from "../types/AuthRequest";
import * as productService from "../services/product.service";
import * as orderService from "../services/order.service";

/** GET /api/admin/stats */
export async function stats(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await orderService.stats());
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/products — mismos filtros que el público, incluye no publicados */
export async function listProducts(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.list({ ...(req.query as any), includeUnpublished: true }));
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/products */
export async function createProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(201).json(await productService.create(req.body));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/products/:id */
export async function updateProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.update(String(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
}

/** DELETE /api/admin/products/:id */
export async function deleteProduct(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await productService.remove(String(req.params.id));
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

/** POST /api/admin/products/:id/image — multipart, campo "image" */
export async function uploadProductImage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.setImage(String(req.params.id), req.file));
  } catch (error) {
    next(error);
  }
}

/** GET /api/admin/orders?status=&page= */
export async function listOrders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    res.status(200).json(await orderService.list(req.query.status as string | undefined, page));
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/orders/:id — body: { status } */
export async function updateOrder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await orderService.setStatus(String(req.params.id), req.body?.status));
  } catch (error) {
    next(error);
  }
}
