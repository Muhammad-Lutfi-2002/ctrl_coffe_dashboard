import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/inventory.js";

export default defineAction({
  description: "Catat saldo awal bahan baku.",
  schema: z.object({
    idMaterials: z.string().uuid(),
    qty: z.number().positive(),
    note: z.string().max(300).optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.recordMovement(tx, actor, { idMaterials: args.idMaterials, movementType: "opening_balance", qty: args.qty, note: args.note }));
  },
});
