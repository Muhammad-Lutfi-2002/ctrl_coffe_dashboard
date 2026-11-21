import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/inventory.js";

export default defineAction({
  description: "Buat stock opname (draft).",
  schema: z.object({
    opnameDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD").optional(),
    note: z.string().max(300).optional(),
    items: z.array(z.object({ idMaterials: z.string().uuid(), countedQty: z.number().min(0) })).min(1),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.createOpname(tx, actor, args));
  },
});
