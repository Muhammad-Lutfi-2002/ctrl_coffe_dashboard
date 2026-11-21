import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/settings.js";

export default defineAction({
  description: "Bobot kriteria SAW.",
  schema: z.object({
  }),
  http: { method: "GET" },
  run: async (args) => {
    const actor = await requireRole("purchasing", "owner");
    return svc.getWeights(getDb());
  },
});
