import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/master.js";

export default defineAction({
  description: "Atur bahan baku yang dipasok supplier.",
  schema: z.object({
    idSuppliers: z.string().uuid(),
    materialIds: z.array(z.string().uuid()),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("purchasing");
    return getDb().transaction((tx) => svc.setSupplierMaterials(tx, actor, args.idSuppliers, args.materialIds));
  },
});
