import { createServerClient } from "@supabase/ssr";
import { getCookie, parseCookies, setCookie, type H3Event } from "h3";

/** Konfigurasi Supabase (server). URL dan publishable key bersifat publik; service role key hanya di server. */
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return { url, key, configured: Boolean(url && key) };
}

type CachedUser = { email: string; id: string; name?: string; exp: number };
const cache = new Map<string, CachedUser>();

/**
 * Sesi dari cookie Supabase (sb-<ref>-auth-token) — satu-satunya sumber identitas.
 * Token divalidasi ke Supabase Auth (getUser), bukan dipercaya begitu saja; hasilnya di-cache 30 detik per token.
 */
export async function getSupabaseSession(event: H3Event): Promise<{ email: string; userId: string; name?: string } | null> {
  const { url, key, configured } = supabaseConfig();
  if (!configured) return null;
  const cookies = parseCookies(event);
  const tokenKey = Object.entries(cookies).filter(([k]) => k.startsWith("sb-")).map(([k, v]) => `${k}=${v}`).join(";");
  if (!tokenKey) return null;
  const hit = cache.get(tokenKey);
  if (hit && hit.exp > Date.now()) return { email: hit.email, userId: hit.id, name: hit.name };

  const supabase = createServerClient(url!, key!, {
    cookies: {
      getAll: () => Object.entries(cookies).map(([name, value]) => ({ name, value: value ?? "" })),
      setAll: (list) => { for (const c of list) { try { setCookie(event, c.name, c.value, c.options as any); } catch { /* respons sudah terkirim */ } } },
    },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;
  const meta = data.user.user_metadata as { full_name?: string } | undefined;
  cache.set(tokenKey, { email: data.user.email, id: data.user.id, name: meta?.full_name, exp: Date.now() + 30_000 });
  if (cache.size > 500) cache.clear();
  return { email: data.user.email, userId: data.user.id, name: meta?.full_name };
}

export { getCookie };
