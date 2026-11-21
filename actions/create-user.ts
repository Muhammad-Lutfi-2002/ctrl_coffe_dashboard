import { fail } from "@agent-native/core/action";
import { defineAction } from "@agent-native/core/action";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getDb } from "../server/db.js";
import { requireRole } from "../server/services/common.js";
import { upsertUserProfile } from "../server/services/master.js";

export default defineAction({
  description: "Buat akun pengguna baru (Supabase Auth) beserta profil dan perannya. Hanya Admin/Owner.",
  schema: z.object({
    email: z.string().email(),
    fullName: z.string().min(1).max(120),
    password: z.string().min(8).max(72),
    roleCode: z.enum(["admin", "purchasing", "finance", "owner"]),
  }),
  http: { method: "POST" },
  run: async (args) => {
    const actor = await requireRole("admin", "owner");
    if (args.roleCode === "owner" && actor.roleCode !== "owner") fail("Hanya Owner yang dapat membuat akun Owner", { statusCode: 403 });
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) fail("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di server", { statusCode: 500 });
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data, error } = await admin.auth.admin.createUser({ email: args.email, password: args.password, email_confirm: true, user_metadata: { full_name: args.fullName } });
    if (error || !data.user) fail(`Gagal membuat akun: ${error?.message ?? "tidak diketahui"}`, { statusCode: 400 });
    try {
      return await getDb().transaction((tx) => upsertUserProfile(tx, actor, { idUsers: data.user.id, email: args.email, fullName: args.fullName, roleCode: args.roleCode }));
    } catch (e) {
      await admin.auth.admin.deleteUser(data.user.id); // jangan tinggalkan akun auth tanpa profil
      throw e;
    }
  },
});
