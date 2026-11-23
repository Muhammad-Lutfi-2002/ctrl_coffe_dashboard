import { configureClientRouterBasename } from "@agent-native/core/client/api-path";
import { installRouteChunkRecovery } from "@agent-native/core/client/route-chunk-recovery";
import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";

installRouteChunkRecovery();

configureClientRouterBasename();

hydrateRoot(document, <HydratedRouter />);

// PWA: memungkinkan aplikasi dipasang (Install app / Add to Home Screen). Hanya di produksi.
if (import.meta.env.PROD && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  });
}
