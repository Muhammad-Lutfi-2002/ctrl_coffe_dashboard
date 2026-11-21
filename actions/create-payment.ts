import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/finance.js";

export default defineAction({
  description: "Buat pembayaran supplier (bertahap; di atas ambang menunggu Owner).",
  schema: z.object({
    idSupplierInvoices: z.string().uuid(),
    amount: z.number().positive(),
    method: z.enum(["transfer","cash","giro"]).default("transfer"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD").optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("finance");
    return getDb().transaction((tx) => svc.createPayment(tx, actor, args));
  },
});
