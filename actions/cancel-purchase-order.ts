import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/procurement.js";

export default defineAction({
  description: "Batalkan PO yang belum ada penerimaan/invoice.",
  schema: z.object({
    idPurchaseOrders: z.string().uuid(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("purchasing");
    return getDb().transaction((tx) => svc.cancelPurchaseOrder(tx, actor, args.idPurchaseOrders));
  },
});
