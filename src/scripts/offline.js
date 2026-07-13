export function isOffline(
  nav = typeof navigator !== "undefined" ? navigator : null,
) {
  return nav?.onLine === false;
}

export function registerServiceWorker(
  nav = typeof navigator !== "undefined" ? navigator : null,
  win = typeof window !== "undefined" ? window : null,
  enabled = import.meta.env?.PROD === true,
) {
  if (!enabled || !nav || !win || !("serviceWorker" in nav)) return false;
  win.addEventListener("load", () => {
    nav.serviceWorker.register("/sw.js").catch(() => {});
  });
  return true;
}
