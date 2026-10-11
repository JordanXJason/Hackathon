"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function randomId() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function storedId(store: Storage, key: string) {
  const current = store.getItem(key);
  if (current && /^[a-f0-9]{32}$/.test(current)) return current;
  const next = randomId();
  store.setItem(key, next);
  return next;
}

function send(body: string) {
  const url = `${BASE}/api/visit`;
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    return;
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname === "/stats" || pathname.startsWith("/api")) return;
    let vid = "";
    let sid = "";
    try {
      vid = storedId(localStorage, "hackathon-vid");
      sid = storedId(sessionStorage, "hackathon-sid");
    } catch {
      return;
    }
    const path = pathname;
    let start = Date.now();
    const reportStay = () => {
      const ms = Date.now() - start;
      start = Date.now();
      if (ms < 500) return;
      send(JSON.stringify({ kind: "stay", vid, sid, path, ms }));
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") reportStay();
      else start = Date.now();
    };

    fetch(`${BASE}/api/visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "view", vid, sid, path }),
      keepalive: true,
    }).catch(() => {});

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", reportStay);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", reportStay);
      reportStay();
    };
  }, [pathname]);

  return null;
}
