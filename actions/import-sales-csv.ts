import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/sales.js";

export default defineAction({
  description: "Impor penjualan dari CSV (validasi penuh, cegah duplikasi).",
  schema: z.object({
    fileName: z.string().min(1).max(200),
    content: z.string().min(1).max(5_000_000),
    dryRun: z.boolean().optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.importSalesCsv(tx, actor, args));
  },
});
