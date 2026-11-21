import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/settings.js";

export default defineAction({
  description: "Ubah bobot SAW (Owner; total harus 100).",
  schema: z.object({
    price: z.number().min(0).max(100),
    performance: z.number().min(0).max(100),
    lead_time: z.number().min(0).max(100),
    payment_term: z.number().min(0).max(100),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("owner");
    return getDb().transaction((tx) => svc.updateWeights(tx, actor, args));
  },
});
