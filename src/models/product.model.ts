import mongoose, { Schema } from "mongoose";

export const SPECIES = ["perro", "gato", "ave", "pez", "roedor", "granja", "general"] as const;
export const PRODUCT_TYPES = [
  "alimento-seco",
  "alimento-humedo",
  "snack",
  "farmacia",
  "higiene",
  "accesorio",
  "otro",
] as const;
export const CATALOGS = ["general", "super-premium"] as const;

export type Species = (typeof SPECIES)[number];
export type ProductType = (typeof PRODUCT_TYPES)[number];
export type CatalogKey = (typeof CATALOGS)[number];

/** Precios en centavos: PVP es el de referencia (va tachado) y PVC el precio Animall. */
export interface IVariant {
  size: string;
  pvp: number;
  pvc: number;
  promo: string | null;
}

export interface IProduct {
  slug: string;
  name: string;
  brand: string;
  manufacturer: string;
  category: string;
  categorySlug: string;
  species: Species;
  type: ProductType;
  catalogs: CatalogKey[];
  variants: IVariant[];
  image: { url: string; publicId: string };
  isPublished: boolean;
  isFeatured: boolean;
  sortIndex: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const variantSchema = new Schema<IVariant>(
  {
    size: { type: String, required: true, trim: true },
    pvp: { type: Number, required: true, min: 0 },
    pvc: { type: Number, required: true, min: 0 },
    promo: { type: String, default: null },
  },
  { _id: false },
);

const productSchema = new Schema<IProduct>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, default: "", index: true },
    manufacturer: { type: String, default: "" },
    category: { type: String, default: "" },
    categorySlug: { type: String, default: "", index: true },
    species: { type: String, enum: SPECIES, default: "general", index: true },
    type: { type: String, enum: PRODUCT_TYPES, default: "otro", index: true },
    catalogs: { type: [String], enum: CATALOGS, default: [] },
    variants: { type: [variantSchema], default: [] },
    image: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    isPublished: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    sortIndex: { type: Number, default: 0 },
  },
  { timestamps: true },
);

productSchema.index({ name: "text", brand: "text", category: "text" });

export const Product =
  mongoose.models.Product || mongoose.model<IProduct>("Product", productSchema);
