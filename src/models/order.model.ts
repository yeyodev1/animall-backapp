import mongoose, { Schema, Types } from "mongoose";

export const ORDER_STATUSES = ["nueva", "confirmada", "entregada", "cancelada"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface IOrderItem {
  product: Types.ObjectId;
  slug: string;
  name: string;
  size: string;
  qty: number;
  pvp: number;
  pvc: number;
  promo: string | null;
  image: string;
}

export interface IOrder {
  code: string;
  customer: { name: string; phone: string; note: string };
  store: string;
  items: IOrderItem[];
  subtotalPvp: number;
  total: number;
  status: OrderStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const itemSchema = new Schema<IOrderItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    slug: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    pvp: { type: Number, required: true },
    pvc: { type: Number, required: true },
    promo: { type: String, default: null },
    image: { type: String, default: "" },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    code: { type: String, required: true, unique: true, index: true },
    customer: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, required: true, trim: true },
      note: { type: String, default: "", trim: true },
    },
    store: { type: String, required: true },
    items: { type: [itemSchema], required: true },
    subtotalPvp: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "nueva", index: true },
  },
  { timestamps: true },
);

export const Order = mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);
