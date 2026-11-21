import { createAuthPlugin } from "@agent-native/core/server";

import { getSupabaseSession } from "../lib/supabase-auth.js";

/**
 * Autentikasi memakai Supabase Auth (email + password). Identitas hanya berasal dari cookie sesi Supabase yang
 * divalidasi di server — bukan dari localStorage. Peran dibaca dari tabel `users`/`roles` pada setiap action.
 */
const session = async (event: Parameters<typeof getSupabaseSession>[0]) => {
  const s = await getSupabaseSession(event);
  return s ? { email: s.email, userId: s.userId, name: s.name } : null;
};

export default createAuthPlugin({
  rootAuth: false,
  getSession: session,
  getBrowserSession: session, // hanya cookie
  publicPaths: ["/login"],
});
