import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/finance.js";

export default defineAction({
  description: "Daftar pembayaran supplier.",
  schema: z.object({
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("finance", "owner");
    return svc.listPayments(getDb());
  },
});
