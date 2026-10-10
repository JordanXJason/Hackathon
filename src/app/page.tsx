import { Suspense } from "react";
import { Board } from "@/components/Board";
import { todayISO } from "@/lib/dates";
import { readCache } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const cache = readCache();
  return (
    <Suspense fallback={null}>
      <Board
        today={todayISO()}
        initialEvents={cache.events}
        initialUpdatedAt={cache.updatedAt}
        initialReport={cache.report}
      />
    </Suspense>
  );
}
