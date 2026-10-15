import { Request, Response, NextFunction } from "express";
import * as orderService from "../services/order.service";

/** POST /api/orders — body: { customer: { name, phone, note }, store, items: [{ slug, size, qty }] } */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { order, whatsappUrl } = await orderService.create(req.body ?? {});
    res.status(201).json({ order, whatsappUrl });
  } catch (error) {
    next(error);
  }
}
