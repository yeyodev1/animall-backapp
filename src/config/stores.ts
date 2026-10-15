/**
 * Puntos de contacto de Animall. Los pedidos web terminan en un chat de
 * WhatsApp con uno de estos números; el cliente elige a cuál escribir.
 */
export const STORES = {
  fiorella: {
    key: "fiorella",
    label: "Fiorella · Pedidos y asesoría",
    whatsapp: "593984704417",
  },
  americas: {
    key: "americas",
    label: "Local Plaza Las Américas",
    whatsapp: "593999063810",
  },
} as const;

export type StoreKey = keyof typeof STORES;

export function isStoreKey(value: unknown): value is StoreKey {
  return typeof value === "string" && value in STORES;
}
