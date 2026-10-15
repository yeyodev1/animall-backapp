import { Request, Response, NextFunction } from "express";
import * as productService from "../services/product.service";

/** GET /api/products — filtros por query: search, species, type, category, brand, catalog, promo, sort, page, limit */
export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.list(req.query as any));
  } catch (error) {
    next(error);
  }
}

/** GET /api/products/filters — opciones de filtro con conteos */
export async function filters(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.filters());
  } catch (error) {
    next(error);
  }
}

/** GET /api/products/featured */
export async function featured(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.featured());
  } catch (error) {
    next(error);
  }
}

/** GET /api/products/:slug — { product, related } */
export async function getBySlug(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await productService.getBySlug(String(req.params.slug)));
  } catch (error) {
    next(error);
  }
}
