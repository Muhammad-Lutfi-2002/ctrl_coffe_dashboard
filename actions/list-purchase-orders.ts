import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/procurement.js";

export default defineAction({
  description: "Daftar PO beserta item, total, dan sisa penerimaan.",
  schema: z.object({
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("admin", "purchasing", "finance", "owner");
    return svc.listPurchaseOrders(getDb());
  },
});
