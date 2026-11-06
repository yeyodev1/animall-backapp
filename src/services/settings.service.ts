import { STORES, StoreKey } from "../config/stores";
import { CustomError } from "../errors/customError.error";
import { Settings } from "../models/settings.model";

export type WhatsappNumbers = Record<StoreKey, string>;

/** 0984 704 417 / +593 98… → 593984704417 (wa.me exige formato internacional). */
export function normalizeWhatsapp(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `593${digits.slice(1)}` : digits;
  return /^\d{11,15}$/.test(intl) ? intl : null;
}

/** Números guardados; si falta alguno se usa el de config/stores. */
export async function getWhatsapp(): Promise<WhatsappNumbers> {
  const doc: any = await Settings.findOne({ key: "main" }).lean();
  const saved = doc?.whatsapp ?? {};
  return {
    fiorella: saved.fiorella || STORES.fiorella.whatsapp,
    americas: saved.americas || STORES.americas.whatsapp,
  };
}

export async function updateWhatsapp(input: any): Promise<WhatsappNumbers> {
  const update: Record<string, string> = {};
  for (const key of Object.keys(STORES) as StoreKey[]) {
    if (input?.[key] === undefined) continue;
    const number = normalizeWhatsapp(input[key]);
    if (!number)
      throw new CustomError(`Número de WhatsApp inválido para ${STORES[key].label}`, 400);
    update[`whatsapp.${key}`] = number;
  }
  if (!Object.keys(update).length) throw new CustomError("No hay números para guardar", 400);

  await Settings.updateOne({ key: "main" }, { $set: update }, { upsert: true });
  return getWhatsapp();
}
