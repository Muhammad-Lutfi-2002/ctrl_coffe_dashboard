import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/finance.js";

export default defineAction({
  description: "Catat pembayaran telah dilakukan.",
  schema: z.object({
    idPayments: z.string().uuid(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("finance");
    return getDb().transaction((tx) => svc.markPaymentPaid(tx, actor, args.idPayments));
  },
});
