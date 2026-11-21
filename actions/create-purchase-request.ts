import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/procurement.js";

export default defineAction({
  description: "Buat Purchase Request multi-item.",
  schema: z.object({
    neededBy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
    notes: z.string().max(500).optional(),
    items: z.array(z.object({ idMaterials: z.string().uuid(), qty: z.number().positive() })).min(1),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("purchasing");
    return getDb().transaction((tx) => svc.createPurchaseRequest(tx, actor, args));
  },
});
