import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/inventory.js";

export default defineAction({
  description: "Riwayat mutasi stok (kartu stok).",
  schema: z.object({
    idMaterials: z.string().uuid().optional(),
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("admin", "purchasing", "owner");
    return svc.listMovements(getDb(), args.idMaterials);
  },
});
