import { normalizeKey } from "./classify";
import { addDays } from "./dates";
import type { EventItem } from "./types";

function richer(a: EventItem, b: EventItem): EventItem {
  const primary = a.summary.length >= b.summary.length ? a : b;
  const secondary = primary === a ? b : a;
  const ages = [...new Set([...primary.ages, ...secondary.ages])].filter((age) =>
    primary.ages.includes("未标明") && secondary.ages.some((item) => item !== "未标明") ? age !== "未标明" : true,
  );
  return {
    ...primary,
    titleZh: primary.titleZh.length >= secondary.titleZh.length ? primary.titleZh : secondary.titleZh,
    prize: primary.prize || secondary.prize,
    organizer: primary.organizer || secondary.organizer,
    city: primary.city || secondary.city,
    country: primary.country || secondary.country,
    deadline: primary.deadline || secondary.deadline,
    deadlineKind: primary.deadline ? primary.deadlineKind : secondary.deadlineKind,
    start: primary.start || secondary.start,
    end: primary.end || secondary.end,
    registrationUrl: primary.registrationUrl || secondary.registrationUrl,
    url: primary.url || secondary.url,
    summary: primary.summary.length >= secondary.summary.length ? primary.summary : secondary.summary,
    ages: ages.length ? ages : ["未标明"],
    sectors: [...new Set([...primary.sectors, ...secondary.sectors])],
    sources: [...new Set([...primary.sources, ...secondary.sources])],
    region: primary.region === "china" || secondary.region === "china" ? "china" : "international",
    format: primary.format === secondary.format ? primary.format : "hybrid",
  };
}

function closeEnough(a: EventItem, b: EventItem): boolean {
  if (a.url && a.url === b.url) return true;
  const cityA = a.city.toLowerCase();
  const cityB = b.city.toLowerCase();
  const citiesFit =
    !cityA ||
    !cityB ||
    cityA === cityB ||
    cityA.includes(cityB) ||
    cityB.includes(cityA);
  if (!a.start || !b.start) return citiesFit;
  const start = a.start < b.start ? a.start : b.start;
  const end = a.start > b.start ? a.start : b.start;
  const withinThreeWeeks = end <= addDays(start, 21);
  if (!withinThreeWeeks) return false;
  if (citiesFit) return true;
  return end <= addDays(start, 3);
}

export function dedupeEvents(events: EventItem[]): EventItem[] {
  const groups = new Map<string, EventItem[]>();
  for (const event of events) {
    const key = normalizeKey(event.title);
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  const merged: EventItem[] = [];
  for (const group of groups.values()) {
    const clusters: EventItem[] = [];
    for (const event of group) {
      const index = clusters.findIndex((item) => closeEnough(item, event));
      if (index === -1) clusters.push(event);
      else clusters[index] = richer(clusters[index], event);
    }
    merged.push(...clusters);
  }
  const folded: EventItem[] = [];
  for (const event of merged) {
    const index = folded.findIndex((item) => sameContest(item, event));
    if (index === -1) folded.push(event);
    else folded[index] = richer(folded[index], event);
  }
  const branded: EventItem[] = [];
  for (const event of folded) {
    const index = branded.findIndex((item) => sameBrand(item, event));
    if (index === -1) branded.push(event);
    else branded[index] = richer(branded[index], event);
  }
  return branded;
}

function brand(title: string): string {
  const head = title.split(/[:：|（(]/)[0];
  return normalizeKey(head);
}

function sameBrand(a: EventItem, b: EventItem): boolean {
  const left = brand(a.title);
  const right = brand(b.title);
  if (left.length < 6 || right.length < 6) return false;
  const short = left.length <= right.length ? left : right;
  const long = left.length <= right.length ? right : left;
  if (short !== long && !long.startsWith(short)) return false;
  if (short.length / long.length < 0.6) return false;
  const aDate = a.start || a.deadline;
  const bDate = b.start || b.deadline;
  if (!aDate || !bDate) return short === long;
  const start = aDate < bDate ? aDate : bDate;
  const end = aDate > bDate ? aDate : bDate;
  return end <= addDays(start, 14);
}

function han(text: string): string {
  return (text.match(/[\u4e00-\u9fff]/g) || []).join("");
}

function sameContest(a: EventItem, b: EventItem): boolean {
  const ha = han(a.title);
  const hb = han(b.title);
  const similar = ha.length >= 4 && hb.length >= 4 && (ha.includes(hb) || hb.includes(ha));
  if (!similar) return false;
  const left = a.deadline || a.start;
  const right = b.deadline || b.start;
  if (!left || !right) return true;
  const start = left < right ? left : right;
  const end = left > right ? left : right;
  return end <= addDays(start, 21);
}
