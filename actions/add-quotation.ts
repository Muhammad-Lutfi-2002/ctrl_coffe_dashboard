import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/procurement.js";

export default defineAction({
  description: "Catat penawaran supplier untuk PR yang disetujui.",
  schema: z.object({
    idPurchaseRequests: z.string().uuid(),
    idSuppliers: z.string().uuid(),
    quotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
    leadTimeDays: z.number().int().min(0),
    paymentTermDays: z.number().int().min(0),
    items: z.array(z.object({ idMaterials: z.string().uuid(), unitPrice: z.number().min(0), minOrderQty: z.number().min(0).optional() })).min(1),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("purchasing");
    return getDb().transaction((tx) => svc.addQuotation(tx, actor, args));
  },
});
