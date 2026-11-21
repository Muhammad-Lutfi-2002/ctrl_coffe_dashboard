import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/finance.js";

export default defineAction({
  description: "Catat invoice supplier.",
  schema: z.object({
    idPurchaseOrders: z.string().uuid(),
    invoiceNumber: z.string().min(1).max(60),
    invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
    items: z.array(z.object({ idPoItems: z.string().uuid(), qtyInvoiced: z.number().positive(), unitPrice: z.number().min(0) })).min(1),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("finance");
    return getDb().transaction((tx) => svc.recordInvoice(tx, actor, args));
  },
});
