import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/procurement.js";

export default defineAction({
  description: "Owner menyetujui atau menolak PR (penolakan wajib catatan).",
  schema: z.object({
    idPurchaseRequests: z.string().uuid(),
    decision: z.enum(["approved","rejected"]),
    note: z.string().max(500).default(""),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("owner");
    return getDb().transaction((tx) => svc.decidePurchaseRequest(tx, actor, args.idPurchaseRequests, args.decision, args.note));
  },
});
