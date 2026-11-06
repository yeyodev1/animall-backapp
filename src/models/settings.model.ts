import mongoose, { Schema } from "mongoose";

/** Documento único con lo que el personal edita desde Configuración. */
const settingsSchema = new Schema(
  {
    key: { type: String, default: "main", unique: true },
    whatsapp: {
      fiorella: { type: String, default: "" },
      americas: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

export const Settings = mongoose.models.Settings || mongoose.model("Settings", settingsSchema);
