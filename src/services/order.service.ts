import { STORES, isStoreKey } from "../config/stores";
import { CustomError } from "../errors/customError.error";
import { ORDER_STATUSES, Order, OrderStatus } from "../models/order.model";
import { Product } from "../models/product.model";

interface OrderInput {
  customer?: { name?: string; phone?: string; note?: string };
  store?: string;
  items?: { slug?: string; size?: string; qty?: number }[];
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function newCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `AM-${code}`;
}

function whatsappMessage(order: any): string {
  const lines = [
    `¡Hola Animall! 🐾 Quiero hacer este pedido (código ${order.code}):`,
    "",
    ...order.items.map(
      (i: any) =>
        `• ${i.qty} × ${i.name} (${i.size}) — ${money(i.pvc * i.qty)}${i.promo ? ` · promo ${i.promo}` : ""}`,
    ),
    "",
    `Total Animall: ${money(order.total)}`,
    `Nombre: ${order.customer.name}`,
    `Teléfono: ${order.customer.phone}`,
  ];
  if (order.customer.note) lines.push(`Nota: ${order.customer.note}`);
  return lines.join("\n");
}

/** Los precios se toman de la base, nunca del carrito del navegador. */
export async function create(input: OrderInput) {
  const name = String(input.customer?.name ?? "").trim();
  const phone = String(input.customer?.phone ?? "").replace(/[^\d+]/g, "");
  const note = String(input.customer?.note ?? "").trim().slice(0, 500);
  if (name.length < 2) throw new CustomError("Escribe tu nombre", 400);
  if (phone.replace(/\D/g, "").length < 7) throw new CustomError("Escribe un teléfono válido", 400);
  if (!isStoreKey(input.store)) throw new CustomError("Elige a dónde enviar el pedido", 400);
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new CustomError("Tu carrito está vacío", 400);
  }
  if (input.items.length > 60) throw new CustomError("El pedido tiene demasiados productos", 400);

  const slugs = [...new Set(input.items.map((i) => String(i.slug ?? "")))];
  const products = await Product.find({ slug: { $in: slugs }, isPublished: true }).lean<any[]>();
  const bySlug = new Map(products.map((p) => [p.slug, p]));

  const items = input.items.map((raw) => {
    const product = bySlug.get(String(raw.slug ?? ""));
    if (!product) throw new CustomError("Un producto del carrito ya no está disponible", 409);
    const variant = product.variants.find((v: any) => v.size === raw.size);
    if (!variant) throw new CustomError(`La presentación de ${product.name} ya no existe`, 409);
    const qty = Math.min(99, Math.max(1, Math.floor(Number(raw.qty) || 1)));
    return {
      product: product._id,
      slug: product.slug,
      name: product.name,
      size: variant.size,
      qty,
      pvp: variant.pvp,
      pvc: variant.pvc,
      promo: variant.promo,
      image: product.image?.url ?? "",
    };
  });

  const total = items.reduce((sum, i) => sum + i.pvc * i.qty, 0);
  const subtotalPvp = items.reduce((sum, i) => sum + i.pvp * i.qty, 0);

  let code = newCode();
  while (await Order.exists({ code })) code = newCode();

  const order = await Order.create({
    code,
    customer: { name, phone, note },
    store: input.store,
    items,
    subtotalPvp,
    total,
  });

  const store = STORES[input.store];
  const whatsappUrl = `https://wa.me/${store.whatsapp}?text=${encodeURIComponent(whatsappMessage(order))}`;
  return { order, whatsappUrl };
}

export async function list(status?: string, page = 1, limit = 30) {
  const filter = status && ORDER_STATUSES.includes(status as OrderStatus) ? { status } : {};
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

export async function setStatus(id: string, status: unknown) {
  if (!ORDER_STATUSES.includes(status as OrderStatus)) throw new CustomError("Estado no válido", 400);
  const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
  if (!order) throw new CustomError("Pedido no encontrado", 404);
  return order;
}

export async function stats() {
  const [byStatus, totals, products, unpublished] = await Promise.all([
    Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
    Order.aggregate([
      { $match: { status: { $ne: "cancelada" } } },
      { $group: { _id: null, revenue: { $sum: "$total" }, orders: { $sum: 1 } } },
    ]),
    Product.countDocuments({}),
    Product.countDocuments({ isPublished: false }),
  ]);
  return {
    orders: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    revenue: totals[0]?.revenue ?? 0,
    ordersCount: totals[0]?.orders ?? 0,
    products,
    unpublished,
  };
}
