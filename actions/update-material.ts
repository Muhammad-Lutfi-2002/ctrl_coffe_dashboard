import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/master.js";

export default defineAction({
  description: "Ubah bahan baku.",
  schema: z.object({
    idMaterials: z.string().uuid(),
    idCategories: z.string().uuid().optional(),
    idUnits: z.string().uuid().optional(),
    sku: z.string().min(1).max(40).optional(),
    materialName: z.string().min(1).max(120).optional(),
    minStock: z.number().min(0).optional(),
    safetyStock: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.updateMaterial(tx, actor, args.idMaterials, (({ idMaterials, ...rest }) => rest)(args)));
  },
});
