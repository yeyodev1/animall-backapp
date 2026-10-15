import { FilterQuery, SortOrder } from "mongoose";
import { CustomError } from "../errors/customError.error";
import {
  CATALOGS,
  IProduct,
  IVariant,
  PRODUCT_TYPES,
  Product,
  SPECIES,
} from "../models/product.model";
import { slugify } from "../utils/slugify";
import { deleteImage, uploadBuffer } from "./cloudinary.service";

export interface ProductQuery {
  search?: string;
  species?: string;
  type?: string;
  category?: string;
  brand?: string;
  catalog?: string;
  promo?: string;
  sort?: string;
  page?: number;
  limit?: number;
  includeUnpublished?: boolean;
}

const SORTS: Record<string, Record<string, SortOrder>> = {
  relevancia: { isFeatured: -1, sortIndex: 1, name: 1 },
  nombre: { name: 1 },
  "precio-asc": { minPrice: 1 },
  "precio-desc": { minPrice: -1 },
  ahorro: { maxSaving: -1 },
};

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilter(q: ProductQuery): FilterQuery<IProduct> {
  const filter: FilterQuery<IProduct> = {};
  if (!q.includeUnpublished) filter.isPublished = true;
  if (q.species) filter.species = { $in: q.species.split(",") };
  if (q.type) filter.type = { $in: q.type.split(",") };
  if (q.category) filter.categorySlug = { $in: q.category.split(",") };
  if (q.brand) filter.brand = { $in: q.brand.split(",") };
  if (q.catalog) filter.catalogs = q.catalog;
  if (q.promo === "1") filter["variants.promo"] = { $nin: [null, ""] };
  if (q.search?.trim()) {
    // Regex por palabra y no $text: el usuario escribe "cani cach" y espera resultados.
    const words = q.search.trim().split(/\s+/).slice(0, 6).map(escapeRegex);
    filter.$and = words.map((w) => ({
      $or: [{ name: new RegExp(w, "i") }, { brand: new RegExp(w, "i") }, { category: new RegExp(w, "i") }],
    }));
  }
  return filter;
}

export async function list(q: ProductQuery) {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(96, Math.max(1, Number(q.limit) || 24));
  const filter = buildFilter(q);
  const sort = SORTS[q.sort ?? "relevancia"] ?? SORTS.relevancia;

  // Los precios viven en las variantes: se calcula el menor PVC para ordenar por precio.
  const [items, total] = await Promise.all([
    Product.aggregate([
      { $match: filter },
      {
        $addFields: {
          minPrice: { $min: "$variants.pvc" },
          maxSaving: {
            $max: {
              $map: { input: "$variants", as: "v", in: { $subtract: ["$$v.pvp", "$$v.pvc"] } },
            },
          },
        },
      },
      { $sort: { ...sort, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
    ]),
    Product.countDocuments(filter),
  ]);

  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function filters() {
  const base = { isPublished: true };
  const group = (field: string) =>
    Product.aggregate([
      { $match: base },
      { $group: { _id: `$${field}`, count: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { count: -1 } },
    ]);
  const [species, types, brands, categories] = await Promise.all([
    group("species"),
    group("type"),
    group("brand"),
    Product.aggregate([
      { $match: base },
      { $group: { _id: "$categorySlug", label: { $first: "$category" }, count: { $sum: 1 } } },
      { $match: { _id: { $nin: [null, ""] } } },
      { $sort: { count: -1 } },
    ]),
  ]);
  const map = (rows: any[]) => rows.map((r) => ({ value: r._id, label: r.label ?? r._id, count: r.count }));
  return {
    species: map(species),
    types: map(types),
    brands: map(brands),
    categories: map(categories),
    total: await Product.countDocuments(base),
  };
}

export async function featured(limit = 12) {
  const items = await Product.find({ isPublished: true, isFeatured: true }).limit(limit).lean();
  if (items.length >= limit) return items;
  // Si el admin aún no marcó destacados, se completan con los de promo.
  const extra = await Product.find({
    isPublished: true,
    _id: { $nin: items.map((i) => i._id) },
    "variants.promo": { $nin: [null, ""] },
    "image.url": { $ne: "" },
  })
    .limit(limit - items.length)
    .lean();
  return [...items, ...extra];
}

export async function getBySlug(slug: string) {
  const product = await Product.findOne({ slug, isPublished: true }).lean<any>();
  if (!product) throw new CustomError("Producto no encontrado", 404);
  const related = await Product.find({
    isPublished: true,
    _id: { $ne: product._id },
    categorySlug: product.categorySlug,
  })
    .limit(8)
    .lean();
  return { product, related };
}

function sanitizeVariants(raw: unknown): IVariant[] {
  if (!Array.isArray(raw)) throw new CustomError("Las presentaciones no son válidas", 400);
  return raw.map((v: any) => {
    const pvp = Math.round(Number(v?.pvp));
    const pvc = Math.round(Number(v?.pvc));
    if (!String(v?.size ?? "").trim() || !Number.isFinite(pvp) || !Number.isFinite(pvc) || pvp < 0 || pvc < 0) {
      throw new CustomError("Cada presentación necesita tamaño, PVP y PVC en centavos", 400);
    }
    const promo = String(v?.promo ?? "").trim();
    return { size: String(v.size).trim(), pvp, pvc, promo: promo && promo !== "-" ? promo : null };
  });
}

function sanitize(input: any, partial: boolean): Partial<IProduct> {
  const data: Partial<IProduct> = {};
  if (input.name !== undefined) data.name = String(input.name).trim();
  if (!partial && !data.name) throw new CustomError("El nombre es obligatorio", 400);
  for (const key of ["brand", "manufacturer", "category"] as const) {
    if (input[key] !== undefined) data[key] = String(input[key]).trim();
  }
  if (data.category !== undefined) data.categorySlug = slugify(data.category);
  if (input.species !== undefined) {
    if (!SPECIES.includes(input.species)) throw new CustomError("Especie no válida", 400);
    data.species = input.species;
  }
  if (input.type !== undefined) {
    if (!PRODUCT_TYPES.includes(input.type)) throw new CustomError("Tipo no válido", 400);
    data.type = input.type;
  }
  if (input.catalogs !== undefined) {
    data.catalogs = (Array.isArray(input.catalogs) ? input.catalogs : []).filter((c: any) =>
      CATALOGS.includes(c),
    );
  }
  if (input.variants !== undefined) data.variants = sanitizeVariants(input.variants);
  if (input.isPublished !== undefined) data.isPublished = Boolean(input.isPublished);
  if (input.isFeatured !== undefined) data.isFeatured = Boolean(input.isFeatured);
  if (input.sortIndex !== undefined) data.sortIndex = Number(input.sortIndex) || 0;
  return data;
}

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || "producto";
  let slug = base;
  let n = 2;
  while (await Product.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function create(input: unknown) {
  const data = sanitize(input ?? {}, false);
  data.slug = await uniqueSlug(data.name!);
  return Product.create(data);
}

export async function update(id: string, input: unknown) {
  const data = sanitize(input ?? {}, true);
  const product = await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!product) throw new CustomError("Producto no encontrado", 404);
  return product;
}

export async function remove(id: string) {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new CustomError("Producto no encontrado", 404);
  if (product.image?.publicId) await deleteImage(product.image.publicId).catch(() => undefined);
}

export async function setImage(id: string, file?: Express.Multer.File) {
  if (!file) throw new CustomError("Falta la imagen", 400);
  if (!file.mimetype.startsWith("image/")) throw new CustomError("El archivo debe ser una imagen", 400);
  const product = await Product.findById(id);
  if (!product) throw new CustomError("Producto no encontrado", 404);
  const previous = product.image?.publicId;
  product.image = await uploadBuffer(file.buffer, "animall/productos");
  await product.save();
  if (previous) await deleteImage(previous).catch(() => undefined);
  return product;
}
