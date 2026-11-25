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

/**
 * Framework selalu mencegat `/login` dan `/signup` (sebelum memeriksa `publicPaths`) lalu menampilkan halaman
 * "Sign in is not configured" bila plugin auth kustom tidak menyediakan `loginHtml`. Karena itu halaman masuk
 * aplikasi berada di `/masuk`, dan `/login` hanya meneruskan (redirect) ke sana agar tautan lama tetap berfungsi.
 */
const LOGIN_REDIRECT_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Masuk ke CTRL + Coffee SCM, sistem informasi supply chain dan dashboard penjualan.">
<meta name="theme-color" content="#1A3C34">
<title>Masuk - CTRL Coffee</title>
<script>location.replace("/masuk" + location.search);</script>
<noscript><meta http-equiv="refresh" content="0;url=/masuk"></noscript>
</head>
<body><p><a href="/masuk">Lanjut ke halaman masuk</a></p></body>
</html>`;

export default createAuthPlugin({
  rootAuth: false,
  getSession: session,
  getBrowserSession: session, // hanya cookie
  loginHtml: LOGIN_REDIRECT_HTML,
  publicPaths: ["/masuk"],
});
