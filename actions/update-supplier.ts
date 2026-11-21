import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/master.js";

export default defineAction({
  description: "Ubah supplier.",
  schema: z.object({
    idSuppliers: z.string().uuid(),
    supplierName: z.string().min(1).max(120).optional(),
    contactName: z.string().max(120).optional(),
    phone: z.string().max(40).optional(),
    email: z.string().max(120).optional(),
    address: z.string().max(300).optional(),
    isActive: z.boolean().optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("purchasing");
    return getDb().transaction((tx) => svc.updateSupplier(tx, actor, args.idSuppliers, (({ idSuppliers, ...rest }) => rest)(args)));
  },
});
