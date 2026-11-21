import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/procurement.js";

export default defineAction({
  description: "Pilih penawaran/supplier (alasan wajib bila bukan rekomendasi).",
  schema: z.object({
    idSupplierQuotations: z.string().uuid(),
    reason: z.string().max(500).default(""),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("purchasing");
    return getDb().transaction((tx) => svc.selectSupplier(tx, actor, args.idSupplierQuotations, args.reason));
  },
});
