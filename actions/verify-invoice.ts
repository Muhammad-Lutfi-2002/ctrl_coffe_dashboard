import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/finance.js";

export default defineAction({
  description: "Verifikasi invoice dengan three-way matching.",
  schema: z.object({
    idSupplierInvoices: z.string().uuid(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("finance");
    return getDb().transaction((tx) => svc.verifyInvoice(tx, actor, args.idSupplierInvoices));
  },
});
