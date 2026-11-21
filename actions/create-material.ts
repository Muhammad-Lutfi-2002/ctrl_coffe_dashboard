import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/master.js";

export default defineAction({
  description: "Tambah bahan baku.",
  schema: z.object({
    idCategories: z.string().uuid(),
    idUnits: z.string().uuid(),
    sku: z.string().min(1).max(40),
    materialName: z.string().min(1).max(120),
    minStock: z.number().min(0),
    safetyStock: z.number().min(0).default(0),
    isActive: z.boolean().optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.createMaterial(tx, actor, args));
  },
});
