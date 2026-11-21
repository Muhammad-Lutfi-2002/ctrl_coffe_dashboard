import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/sales.js";

export default defineAction({
  description: "Catat transaksi penjualan manual.",
  schema: z.object({
    trxDate: z.string().optional(),
    items: z.array(z.object({ idProducts: z.string().uuid(), qty: z.number().positive(), unitPrice: z.number().min(0).optional() })).min(1),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.createSale(tx, actor, args));
  },
});
