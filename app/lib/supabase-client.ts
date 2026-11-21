import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Klien Supabase di browser (URL + publishable key bersifat publik). Sesi disimpan di cookie, dibaca server untuk otorisasi. */
export function supabaseBrowser() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!url || !key) throw new Error("VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY belum dikonfigurasi");
  client ??= createBrowserClient(url, key);
  return client;
}
