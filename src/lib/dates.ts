const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export function isoDate(year: number, month: number, day: number): string | null {
  if (!year || !month || !day) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 10);
}

export function fromUnix(seconds: number | null | undefined): string | null {
  if (!seconds || seconds < 1000000000) return null;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function parseOne(chunk: string, fallbackYear: number | null): { y: number; m: number; d: number } | null {
  const match = chunk
    .trim()
    .match(/([A-Za-z]+)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?/i);
  if (!match) return null;
  const month = MONTHS[match[1].slice(0, 3).toLowerCase()];
  const day = Number(match[2]);
  const year = match[3] ? Number(match[3]) : fallbackYear;
  if (!month || !day || !year) return null;
  return { y: year, m: month, d: day };
}

export function parseEnglishRange(input: string): { start: string | null; end: string | null } {
  const text = input.replace(/\s+/g, " ").trim();
  const yearMatch = text.match(/(\d{4})/g);
  const endYear = yearMatch ? Number(yearMatch[yearMatch.length - 1]) : null;
  const parts = text.split(/\s+[–—-]\s+/);
  if (parts.length < 2) {
    const one = parseOne(text, endYear);
    const iso = one ? isoDate(one.y, one.m, one.d) : null;
    return { start: iso, end: iso };
  }
  const end = parseOne(parts[1], endYear);
  const start = parseOne(parts[0], end?.y ?? endYear);
  return {
    start: start ? isoDate(start.y, start.m, start.d) : null,
    end: end ? isoDate(end.y, end.m, end.d) : null,
  };
}

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function formatDay(iso: string | null): string {
  if (!iso) return "日期待定";
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "日期待定";
  const year = Number(match[1]);
  const current = Number(todayISO().slice(0, 4));
  const prefix = year === current ? "" : `${year}年`;
  return `${prefix}${Number(match[2])}月${Number(match[3])}日`;
}

export function daysUntil(iso: string | null, today = todayISO()): number | null {
  if (!iso) return null;
  const [y1, m1, d1] = today.split("-").map(Number);
  const [y2, m2, d2] = iso.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.round((b - a) / 86400000);
}

export function rangesOverlap(
  start: string | null,
  end: string | null,
  windowStart: string,
  windowEnd: string,
): boolean {
  const eventStart = start || end || windowStart;
  const eventEnd = end || start || eventStart;
  return eventStart <= windowEnd && eventEnd >= windowStart;
}

export function shanghaiStamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${shifted.getUTCFullYear()}/${pad(shifted.getUTCMonth() + 1)}/${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`;
}

export function monthMatrix(year: number, month: number): Array<string | null> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= days; day += 1) cells.push(isoDate(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
