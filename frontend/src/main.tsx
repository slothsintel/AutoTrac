import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

/**
 * IMPORTANT:
 * GitHub Pages can keep an old Service Worker forever.
 * That old SW is currently caching API GET responses (projects/incomes/time-entries),
 * causing the app to show empty data after refresh.
 *
 * This block unregisters any existing SW + clears caches once,
 * so the app always fetches fresh data from Render.
 */
async function nukeOldServiceWorkerAndCaches() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    if (regs.length) {
      await Promise.all(regs.map((r) => r.unregister()));
    }

    // Clear Cache Storage (where stale API responses may be stored)
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }

    // If we removed something, force a clean reload once
    if (regs.length) {
      window.location.reload();
    }
  } catch (e) {
    console.warn("SW cleanup failed:", e);
  }
}

// Run after page load
window.addEventListener("load", () => {
  void nukeOldServiceWorkerAndCaches();
});

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
