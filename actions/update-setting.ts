import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/settings.js";

export default defineAction({
  description: "Ubah pengaturan (ambang persetujuan pembayaran / nilai awal supplier baru).",
  schema: z.object({
    key: z.enum(["payment_approval_threshold","new_supplier_performance_score"]),
    value: z.number().min(0),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("owner");
    return getDb().transaction((tx) => svc.setSetting(tx, actor, args.key, args.value));
  },
});
