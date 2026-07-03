"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    const isAndroidApp = navigator.userAgent.includes("SEEKR-Android");
    if (isAndroidApp) {
      document.documentElement.classList.add("seekr-android");
      return () => document.documentElement.classList.remove("seekr-android");
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The app remains usable when service workers are unavailable in dev.
    });
  }, []);

  return null;
}
