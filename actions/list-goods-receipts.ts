import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/receiving.js";

export default defineAction({
  description: "Daftar penerimaan barang.",
  schema: z.object({
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("admin", "purchasing", "finance", "owner");
    return svc.listGoodsReceipts(getDb());
  },
});
