import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/finance.js";

export default defineAction({
  description: "Laporan keuangan periodik (anggaran vs realisasi).",
  schema: z.object({
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("finance", "owner");
    return svc.financeReport(getDb(), args.period);
  },
});
