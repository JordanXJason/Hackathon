"use client";

import { useRouter } from "next/navigation";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const RETURN_KEY = "sai-return";

export function rememberList() {
  const path = BASE && window.location.pathname.startsWith(BASE)
    ? window.location.pathname.slice(BASE.length) || "/"
    : window.location.pathname;
  sessionStorage.setItem(RETURN_KEY, `${path}${window.location.search}`);
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
        if (saved) router.push(saved);
        else if (window.history.length > 1) router.back();
        else router.push("/");
      }}
    >
      返回赛历
    </a>
  );
}
