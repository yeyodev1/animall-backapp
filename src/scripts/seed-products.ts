/**
 * Carga los productos extraídos de los catálogos Soldis 2026.
 * Uso: pnpm seed:products <ruta a products.json>
 *
 * Idempotente: busca por slug. Una imagen ya subida no se vuelve a subir, y
 * los campos que el admin edita a mano (publicado, destacado) no se pisan.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { Product } from "../models/product.model";
import { slugify } from "../utils/slugify";

async function uploadIfNeeded(file: string, slug: string, current?: string) {
  if (current) return null;
  if (!fs.existsSync(file)) return null;
  const result = await cloudinary.uploader.upload(file, {
    folder: "animall/productos",
    public_id: slug,
    overwrite: true,
    resource_type: "image",
  });
  return { url: result.secure_url, publicId: result.public_id };
}

async function main() {
  const jsonPath = process.argv[2];
  if (!jsonPath) {
    console.error("✖ Falta la ruta: pnpm seed:products ../data/products.json");
    process.exit(1);
  }
  const baseDir = path.dirname(path.resolve(jsonPath));
  const rows: any[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  await mongoose.connect(env.DB_URI);

  let created = 0;
  let updated = 0;
  let images = 0;
  const pending = [...rows.entries()];

  // Subidas en paralelo de a 6: Cloudinary acepta más, pero así no se satura la conexión.
  async function worker() {
    for (let next = pending.shift(); next; next = pending.shift()) {
      const [index, row] = next;
      const existing = await Product.findOne({ slug: row.slug });
      const image = row.image
        ? await uploadIfNeeded(path.join(baseDir, row.image), row.slug, existing?.image?.url)
        : null;
      if (image) images++;
      const data = {
        name: row.name,
        brand: row.brand ?? "",
        manufacturer: row.manufacturer ?? "",
        category: row.category ?? "",
        categorySlug: slugify(row.category ?? ""),
        species: row.species ?? "general",
        type: row.type ?? "otro",
        catalogs: row.catalogs ?? [],
        variants: (row.variants ?? []).map((v: any) => ({
          size: v.size,
          pvp: v.pvp ?? 0,
          pvc: v.pvc ?? v.pvp ?? 0,
          promo: v.promo && v.promo !== "-" ? v.promo : null,
        })),
        sortIndex: index,
        ...(image ? { image } : {}),
      };
      if (existing) {
        await Product.updateOne({ _id: existing._id }, data);
        updated++;
      } else {
        await Product.create({ slug: row.slug, ...data, isPublished: data.variants.length > 0 });
        created++;
      }
      if ((created + updated) % 25 === 0) console.log(`… ${created + updated}/${rows.length}`);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));

  console.log(`✔ ${created} creados, ${updated} actualizados, ${images} imágenes subidas`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
