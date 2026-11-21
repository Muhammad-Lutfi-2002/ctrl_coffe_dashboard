import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/finance.js";

export default defineAction({
  description: "Catat pengeluaran operasional.",
  schema: z.object({
    expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD"),
    description: z.string().min(1).max(200),
    amount: z.number().positive(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("finance");
    return getDb().transaction((tx) => svc.recordExpense(tx, actor, args));
  },
});
