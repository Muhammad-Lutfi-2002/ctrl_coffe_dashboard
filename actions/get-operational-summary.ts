import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import { operationalSummary } from "../server/services/dashboard.js";

export default defineAction({
  description: "Ringkasan dashboard operasional sesuai peran pengguna.",
  schema: z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }),
  http: { method: "GET" },
  run: async ({ period }) => {
    const actor = await requireRole("admin", "purchasing", "finance", "owner");
    return operationalSummary(getDb(), actor.roleCode, period);
  },
});
