import { configureTracking } from "@agent-native/core/client/analytics";
import { appPath } from "@agent-native/core/client/api-path";
import { useDbSync } from "@agent-native/core/client/hooks";
import { createAgentNativeQueryClient } from "@agent-native/core/client/hooks";
import { getThemeInitScript } from "@agent-native/core/client/ui";
import { AppProviders } from "@agent-native/toolkit/app/providers";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLocation,
} from "react-router";
import type { LinksFunction } from "react-router";

import { Layout as AppLayout } from "@/components/layout/Layout";
import { AppToolkitProvider } from "@/components/ui/toolkit-provider";
import { useNavigationState } from "@/hooks/use-navigation-state";
import { APP_NAME, APP_TITLE } from "@/lib/app-config";
import { TAB_ID } from "@/lib/tab-id";

import stylesheet from "./global.css?url";

configureTracking({
  getDefaultProps: (_name, properties) => ({
    ...properties,
    app: APP_NAME,
  }),
});

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: stylesheet },
];

const SUPABASE_ORIGIN = (() => { try { return new URL(import.meta.env.VITE_SUPABASE_URL as string).origin; } catch { return null; } })();
const THEME_INIT_SCRIPT = getThemeInitScript("light", false);
const FORCE_LIGHT_SCRIPT =
  "try{localStorage.setItem('theme','light')}catch(e){}var r=document.documentElement;r.classList.remove('dark');r.classList.add('light');r.setAttribute('data-theme','light');r.style.colorScheme='light';";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta
          name="description"
          content="CTRL + Coffee SCM: sistem informasi supply chain dan dashboard analitik penjualan untuk UMKM kedai kopi."
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: FORCE_LIGHT_SCRIPT }}
        />
        {/* guard:allow-raw-color - theme-color metadata requires a concrete browser-chrome color. */}
        <meta name="theme-color" content="#1A3C34" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="CTRL Coffee" />
        <meta name="application-name" content="CTRL Coffee" />
        <link rel="icon" type="image/png" sizes="48x48" href={appPath("/favicon-48.png")} />
        <link rel="icon" type="image/png" sizes="32x32" href={appPath("/favicon-32.png")} />
        <link rel="icon" type="image/svg+xml" href={appPath("/favicon.svg")} />
        <link rel="apple-touch-icon" href={appPath("/icon-180.png")} />
        {SUPABASE_ORIGIN ? <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="" /> : null}
        <link rel="manifest" href={appPath("/manifest.webmanifest")} />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function DbSyncSetup() {
  const qc = useQueryClient();
  useNavigationState();
  useDbSync({
    queryClient: qc,
    ignoreSource: TAB_ID,
  });
  return null;
}

/**
 * Halaman masuk harus publik di sisi klien juga. Tanpa ini gate sesi framework (RequireSession) melihat
 * pengunjung belum login di `/masuk`, mengirimnya ke `/sign-in?c=…`, lalu `/sign-in` kembali ke `/masuk?c=…`
 * sehingga terjadi loop refresh tanpa akhir.
 */
const PUBLIC_PATHS = new Set(["/masuk"]);

export default function Root() {
  const [queryClient] = useState(() => createAgentNativeQueryClient());
  const { pathname } = useLocation();
  const isPublicPath = PUBLIC_PATHS.has(pathname.replace(/\/+$/, "") || "/");
  return (
    <AppToolkitProvider>
      <AppProviders queryClient={queryClient} isPublicPath={isPublicPath}>
        {isPublicPath ? null : <DbSyncSetup />}
        <AppLayout>
          <Outlet />
        </AppLayout>
      </AppProviders>
    </AppToolkitProvider>
  );
}

export { ErrorBoundary } from "@agent-native/toolkit/app/shared";
