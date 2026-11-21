import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/inventory.js";

export default defineAction({
  description: "Finalisasi stock opname dan catat selisih sebagai mutasi.",
  schema: z.object({
    idStockOpnames: z.string().uuid(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.finalizeOpname(tx, actor, args.idStockOpnames));
  },
});
