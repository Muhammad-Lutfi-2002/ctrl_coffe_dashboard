import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/master.js";

export default defineAction({
  description: "Daftar supplier beserta kinerja historis.",
  schema: z.object({
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("admin", "purchasing", "finance", "owner");
    return svc.listSuppliers(getDb());
  },
});
