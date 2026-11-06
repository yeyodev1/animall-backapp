import { STORES, StoreKey } from "../config/stores";
import { CustomError } from "../errors/customError.error";
import { Settings } from "../models/settings.model";

export type WhatsappNumbers = Record<StoreKey, string>;
export type EnabledStores = Record<StoreKey, boolean>;
export type StoreSettings = { whatsapp: WhatsappNumbers; enabled: EnabledStores };

const STORE_KEYS = Object.keys(STORES) as StoreKey[];

/** 0984 704 417 / +593 98… → 593984704417 (wa.me exige formato internacional). */
export function normalizeWhatsapp(value: unknown): string | null {
  const digits = String(value ?? "").replace(/\D/g, "");
  const intl = digits.startsWith("0") ? `593${digits.slice(1)}` : digits;
  return /^\d{11,15}$/.test(intl) ? intl : null;
}

/** Lo guardado; si falta algo se usa config/stores y el número queda activo. */
export async function getSettings(): Promise<StoreSettings> {
  const doc: any = await Settings.findOne({ key: "main" }).lean();
  const whatsapp = {} as WhatsappNumbers;
  const enabled = {} as EnabledStores;
  for (const key of STORE_KEYS) {
    whatsapp[key] = doc?.whatsapp?.[key] || STORES[key].whatsapp;
    enabled[key] = doc?.enabled?.[key] !== false;
  }
  return { whatsapp, enabled };
}

export async function updateSettings(input: any): Promise<StoreSettings> {
  const current = await getSettings();
  const update: Record<string, string | boolean> = {};

  for (const key of STORE_KEYS) {
    if (input?.whatsapp?.[key] !== undefined) {
      const number = normalizeWhatsapp(input.whatsapp[key]);
      if (!number) throw new CustomError(`Número de WhatsApp inválido para ${STORES[key].label}`, 400);
      update[`whatsapp.${key}`] = number;
    }
    if (input?.enabled?.[key] !== undefined) {
      current.enabled[key] = input.enabled[key] === true;
      update[`enabled.${key}`] = current.enabled[key];
    }
  }
  if (!Object.keys(update).length) throw new CustomError("No hay cambios para guardar", 400);
  // Sin ningún número activo la web no tendría a dónde mandar los pedidos.
  if (!STORE_KEYS.some((key) => current.enabled[key])) {
    throw new CustomError("Deja al menos un número de WhatsApp activo", 400);
  }

  await Settings.updateOne({ key: "main" }, { $set: update }, { upsert: true });
  return getSettings();
}
