import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/sales.js";

export default defineAction({
  description: "Dashboard analitik penjualan (dihitung dari transaksi tersimpan).",
  schema: z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
    granularity: z.enum(["day","week","month"]).default("day"),
    idCategories: z.string().uuid().optional(),
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("owner", "finance");
    return svc.salesDashboard(getDb(), args);
  },
});
