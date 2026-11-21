import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/finance.js";

export default defineAction({
  description: "Tetapkan anggaran bulanan.",
  schema: z.object({
    period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    amount: z.number().min(0),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("finance");
    return getDb().transaction((tx) => svc.setBudget(tx, actor, args.period, args.amount));
  },
});
