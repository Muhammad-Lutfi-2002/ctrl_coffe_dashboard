import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/procurement.js";

export default defineAction({
  description: "Buat PO dari penawaran terpilih.",
  schema: z.object({
    idPurchaseRequests: z.string().uuid(),
    orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD").optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("purchasing");
    return getDb().transaction((tx) => svc.createPurchaseOrder(tx, actor, args.idPurchaseRequests, args.orderDate));
  },
});
