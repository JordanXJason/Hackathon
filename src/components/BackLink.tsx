"use client";

import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const RETURN_KEY = "sai-return";
const SCROLL_KEY = "sai-scroll";
const FROM_LIST_KEY = "sai-from-list";

function listPath() {
  const path = BASE && window.location.pathname.startsWith(BASE)
    ? window.location.pathname.slice(BASE.length) || "/"
    : window.location.pathname;
  return `${path}${window.location.search}`;
}

export function rememberList() {
  sessionStorage.setItem(RETURN_KEY, listPath());
}

export function rememberPlace(eventId: string) {
  rememberList();
  sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  sessionStorage.setItem(FROM_LIST_KEY, eventId);
}

export function BackLink() {
  const router = useRouter();
  return (
    <a
      className="back"
      href={`${BASE}/`}
      onClick={(event) => {
        event.preventDefault();
        const saved = sessionStorage.getItem(RETURN_KEY);
        const from = sessionStorage.getItem(FROM_LIST_KEY);
        const id = window.location.pathname.split("/").filter(Boolean).pop();
        if (from && from === id && window.history.length > 1) {
          sessionStorage.removeItem(FROM_LIST_KEY);
          router.back();
          return;
        }
        if (saved) router.push(saved, { scroll: false });
        else router.push("/", { scroll: false });
      }}
    >
      返回赛历
    </a>
  );
}
