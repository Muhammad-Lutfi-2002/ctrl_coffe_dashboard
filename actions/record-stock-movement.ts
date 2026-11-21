import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/inventory.js";

export default defineAction({
  description: "Catat barang keluar (pemakaian/rusak/kedaluwarsa) atau penyesuaian stok.",
  schema: z.object({
    idMaterials: z.string().uuid(),
    movementType: z.enum(["usage","damaged","expired","adjustment"]),
    qty: z.number(),
    note: z.string().max(300).optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.recordMovement(tx, actor, { idMaterials: args.idMaterials, movementType: args.movementType, qty: args.qty, note: args.note }));
  },
});
