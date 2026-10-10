import type { EventFormat, EventItem } from "./types";
import { daysUntil, formatDay, todayISO } from "./dates";

export function formatText(format: EventFormat): string {
  if (format === "online") return "线上";
  if (format === "offline") return "线下";
  return "线上 + 线下";
}

export function deadlinePhrase(event: Pick<EventItem, "deadline" | "deadlineKind">): string {
  if (!event.deadline) return "截止未公布";
  const label = event.deadlineKind === "submission" ? "提交截止" : "报名截止";
  return `${label} ${formatDay(event.deadline)}`;
}

export function statusPhrase(event: Pick<EventItem, "deadline">, today = todayISO()): string {
  if (!event.deadline) return "截止未公布";
  const left = daysUntil(event.deadline, today);
  if (left === null) return "截止未公布";
  if (left < 0) return "报名已截止";
  if (left === 0) return "今天截止";
  if (left <= 7) return `${left} 天后截止`;
  return "报名中";
}

export function isUrgent(event: Pick<EventItem, "deadline">, today = todayISO()): boolean {
  const left = daysUntil(event.deadline, today);
  return left !== null && left >= 0 && left <= 7;
}

export function isClosed(event: Pick<EventItem, "deadline">, today = todayISO()): boolean {
  const left = daysUntil(event.deadline, today);
  return left !== null && left < 0;
}

const KNOWN_CITY =
  /北京|上海|广州|深圳|杭州|成都|重庆|南京|武汉|西安|苏州|厦门|青岛|天津|长沙|合肥|长春|香港|澳门|台北|新加坡|东京|首尔|纽约|伦敦|巴黎/;

export function displayTitle(title: string): string {
  return title
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function readableText(text: string): string {
  return text
    .replace(/([。；])/g, "$1\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cityLabel(event: Pick<EventItem, "city" | "country">): string {
  const known = `${event.city} ${event.country}`.match(KNOWN_CITY);
  if (known) {
    const country =
      event.country && event.country !== "未注明" && event.country !== "线上" && event.country !== known[0]
        ? ` · ${event.country}`
        : "";
    return `${known[0]}${country}`;
  }
  const city = event.city.trim();
  if (city && city.length <= 8 && !city.includes("线上")) return city;
  if (event.country && event.country !== "未注明" && event.country !== "线上") return event.country;
  return "";
}

export function placeLine(event: Pick<EventItem, "format" | "city" | "country">): string {
  if (event.format === "online") return "线上";
  return [formatText(event.format), cityLabel(event)].filter(Boolean).join(" · ");
}

export function registrationLine(event: Pick<EventItem, "deadline" | "deadlineKind">, today = todayISO()): string {
  if (!event.deadline) return "截止未公布";
  return `${deadlinePhrase(event)} · ${statusPhrase(event, today)}`;
}

export function rowFace(event: EventItem, today: string): { date: string | null; label: string; urgent: boolean } {
  if (!event.deadline && event.start && event.start < today && event.end && event.end >= today) {
    const left = daysUntil(event.end, today);
    if (left === 0) return { date: event.end, label: "今天结束", urgent: true };
    if (left !== null && left > 0 && left <= 7) return { date: event.end, label: `${left} 天后结束`, urgent: true };
    return { date: event.end, label: "进行中", urgent: false };
  }
  if (!event.deadline) return { date: event.start, label: "开赛日", urgent: false };
  if (isClosed(event, today)) {
    return { date: event.deadline, label: event.deadlineKind === "submission" ? "提交已截止" : "报名已截止", urgent: false };
  }
  if (isUrgent(event, today)) return { date: event.deadline, label: statusPhrase(event, today), urgent: true };
  return {
    date: event.deadline,
    label: event.deadlineKind === "submission" ? "提交截止" : "报名截止",
    urgent: false,
  };
}

export function sortMark(event: EventItem, today: string): { rank: number; date: string } {
  if (event.deadline && !isClosed(event, today)) return { rank: 0, date: event.deadline };
  if (!event.deadline) {
    if (event.start && event.start < today && event.end) return { rank: 1, date: event.end };
    return { rank: 1, date: event.start || event.end || "9999-99-99" };
  }
  return { rank: 2, date: event.start || event.deadline || "9999-99-99" };
}

export function ageText(ages: EventItem["ages"]): string {
  const named = ages.filter((age) => age !== "未标明");
  if (named.length === 0) return "年龄未标明";
  return named.join(" · ");
}
