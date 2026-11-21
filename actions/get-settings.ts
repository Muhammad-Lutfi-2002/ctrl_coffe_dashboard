import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import { getSetting } from "../server/services/settings.js";

export default defineAction({
  description: "Pengaturan sistem: ambang persetujuan pembayaran dan nilai awal supplier baru.",
  schema: z.object({}),
  http: { method: "GET" },
  run: async () => {
    await requireRole("admin", "purchasing", "finance", "owner");
    const db = getDb();
    return {
      paymentApprovalThreshold: Number(await getSetting(db, "payment_approval_threshold", "5000000")),
      newSupplierPerformanceScore: Number(await getSetting(db, "new_supplier_performance_score", "70")),
    };
  },
});
