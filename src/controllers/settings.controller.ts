import { Request, Response, NextFunction } from "express";
import * as settingsService from "../services/settings.service";

/** GET /api/settings — público: la web lo usa para sus botones de WhatsApp */
export async function get(_req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await settingsService.getSettings());
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/admin/settings — body: { whatsapp?: { fiorella?, americas? }, enabled?: { … } } */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    res.status(200).json(await settingsService.updateSettings(req.body));
  } catch (error) {
    next(error);
  }
}
