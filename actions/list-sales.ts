import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/sales.js";

export default defineAction({
  description: "Daftar transaksi penjualan.",
  schema: z.object({
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("admin", "finance", "owner");
    return svc.listSales(getDb());
  },
});
