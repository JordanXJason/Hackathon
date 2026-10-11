import { hasChinese, toEvent } from "./classify";
import { addDays, todayISO } from "./dates";
import { dedupeEvents } from "./dedupe";
import { readCache, writeCache } from "./store";
import { pullAll, reportOf } from "./sources";
import { translateTitles } from "./translate";
import type { CacheFile, EventItem, SourceReport } from "./types";

export async function refreshAll(onProgress: (message: string) => void): Promise<CacheFile> {
  const pulls = await pullAll(onProgress);
  const today = todayISO();
  const horizon = addDays(today, 365);
  const drafted = dedupeEvents(
    pulls.flatMap((pull) => pull.drafts).map((item) => toEvent(item, "")),
  ).filter((event) => inHorizon(event, today, horizon));
  onProgress("正在翻译名称");
  const translations = await translateTitles(
    drafted.map((item) => item.title),
    onProgress,
  );
  const events = drafted.map((event) => ({
    ...event,
    titleZh: translations.get(event.title) || (hasChinese(event.title) ? "" : ""),
  }));

  const keptBySource = new Map<string, number>();
  for (const event of events) {
    for (const source of event.sources) keptBySource.set(source, (keptBySource.get(source) || 0) + 1);
  }
  const report: SourceReport[] = pulls.map((pull) => reportOf(pull, keptBySource.get(pull.source) || 0));
  const cache: CacheFile = {
    updatedAt: new Date().toISOString(),
    events: events.sort(compareEvents),
    report,
  };
  onProgress("正在写入清单");
  writeCache(cache);
  return cache;
}

function inHorizon(event: EventItem, today: string, horizon: string): boolean {
  const end = event.end || event.deadline || event.start;
  const start = event.start || event.deadline || event.end;
  if (!end && !start) return false;
  if (end && end < today) return false;
  if (start && start > horizon) return false;
  return true;
}

function compareEvents(a: EventItem, b: EventItem): number {
  const aKey = a.deadline || a.start || "9999-99-99";
  const bKey = b.deadline || b.start || "9999-99-99";
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  return a.title.localeCompare(b.title, "zh");
}

export function loadCache(): CacheFile {
  return readCache();
}
