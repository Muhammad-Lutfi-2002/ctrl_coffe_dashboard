import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/master.js";

export default defineAction({
  description: "Atur resep produk (bahan baku dan kuantitas per porsi).",
  schema: z.object({
    idProducts: z.string().uuid(),
    items: z.array(z.object({ idMaterials: z.string().uuid(), qtyUsed: z.number().positive() })),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.setRecipe(tx, actor, args.idProducts, args.items));
  },
});
