import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/inventory.js";

export default defineAction({
  description: "Bahan baku di bawah stok minimum.",
  schema: z.object({
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("admin", "purchasing", "owner");
    return svc.lowStock(getDb());
  },
});
