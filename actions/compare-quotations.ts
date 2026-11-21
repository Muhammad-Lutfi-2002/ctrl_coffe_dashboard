import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/procurement.js";

export default defineAction({
  description: "Perbandingan penawaran dan skor SAW untuk satu PR.",
  schema: z.object({
    idPurchaseRequests: z.string().uuid(),
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("purchasing", "owner");
    return svc.compareQuotations(getDb(), args.idPurchaseRequests);
  },
});
