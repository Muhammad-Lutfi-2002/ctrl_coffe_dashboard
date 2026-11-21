import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import * as svc from "../server/services/master.js";

export default defineAction({
  description: "Ubah peran atau status aktif pengguna.",
  schema: z.object({
    idUsers: z.string().uuid(),
    roleCode: z.enum(["admin","purchasing","finance","owner"]).optional(),
    isActive: z.boolean().optional(),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin", "owner");
    return getDb().transaction((tx) => svc.updateUserAccess(tx, actor, args.idUsers, { roleCode: args.roleCode, isActive: args.isActive }));
  },
});
