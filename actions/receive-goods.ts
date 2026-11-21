import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/receiving.js";

export default defineAction({
  description: "Catat penerimaan barang terhadap PO (mendukung parsial) dan mutasi stok.",
  schema: z.object({
    idPurchaseOrders: z.string().uuid(),
    note: z.string().max(300).optional(),
    items: z.array(z.object({ idPoItems: z.string().uuid(), qtyAccepted: z.number().min(0), qtyRejected: z.number().min(0).optional() })).min(1),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin");
    return getDb().transaction((tx) => svc.receiveGoods(tx, actor, args));
  },
});
