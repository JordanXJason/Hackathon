import fs from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "visits.jsonl");
const MAX_STAY_MS = 30 * 60 * 1000;

export type VisitKind = "view" | "stay";

export type VisitRow = {
  t: string;
  kind: VisitKind;
  vid: string;
  sid: string;
  path: string;
  ms?: number;
};

export type VisitSummary = {
  uv: number;
  pv: number;
  visits: number;
  stayMs: number;
  avgStayMs: number;
  avgPages: number;
};

export type VisitSession = {
  sid: string;
  start: string;
  pages: number;
  stayMs: number;
  lastPath: string;
};

function isRow(value: unknown): value is VisitRow {
  if (!value || typeof value !== "object") return false;
  const row = value as VisitRow;
  return (
    typeof row.t === "string" &&
    (row.kind === "view" || row.kind === "stay") &&
    typeof row.vid === "string" &&
    typeof row.sid === "string" &&
    typeof row.path === "string"
  );
}

export function readVisits(): VisitRow[] {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const rows: VisitRow[] = [];
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const parsed: unknown = JSON.parse(line);
        if (isRow(parsed)) rows.push(parsed);
      } catch {
        // 坏行跳过，不影响后面的记录
      }
    }
    return rows;
  } catch {
    return [];
  }
}

export function appendVisit(row: VisitRow) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(row)}\n`);
}

export function acceptVisit(body: unknown): VisitRow | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Partial<VisitRow>;
  if (input.kind !== "view" && input.kind !== "stay") return null;
  if (typeof input.vid !== "string" || !/^[a-f0-9]{32}$/.test(input.vid)) return null;
  if (typeof input.sid !== "string" || !/^[a-f0-9]{32}$/.test(input.sid)) return null;
  if (typeof input.path !== "string" || !/^\/[\w./-]{0,180}$/.test(input.path)) return null;
  if (input.path === "/stats" || input.path.startsWith("/api")) return null;
  const row: VisitRow = {
    t: new Date().toISOString(),
    kind: input.kind,
    vid: input.vid,
    sid: input.sid,
    path: input.path,
  };
  if (input.kind === "stay") {
    const ms = Number(input.ms);
    if (!Number.isFinite(ms) || ms < 0) return null;
    row.ms = Math.min(Math.round(ms), MAX_STAY_MS);
  }
  return row;
}

export function summarize(rows: VisitRow[]): VisitSummary {
  const views = rows.filter((row) => row.kind === "view");
  const visitors = new Set(views.map((row) => row.vid));
  const sessions = new Set(views.map((row) => row.sid));
  const stayMs = rows.reduce((sum, row) => sum + (row.kind === "stay" ? row.ms || 0 : 0), 0);
  const visits = sessions.size;
  return {
    uv: visitors.size,
    pv: views.length,
    visits,
    stayMs,
    avgStayMs: visits ? stayMs / visits : 0,
    avgPages: visits ? views.length / visits : 0,
  };
}

export function recentSessions(rows: VisitRow[], limit = 12): VisitSession[] {
  const grouped = new Map<string, VisitSession>();
  for (const row of rows) {
    const current = grouped.get(row.sid) ?? { sid: row.sid, start: row.t, pages: 0, stayMs: 0, lastPath: row.path };
    if (row.t < current.start) current.start = row.t;
    if (row.kind === "view") {
      current.pages += 1;
      current.lastPath = row.path;
    } else {
      current.stayMs += row.ms || 0;
    }
    grouped.set(row.sid, current);
  }
  return [...grouped.values()].sort((a, b) => (a.start < b.start ? 1 : -1)).slice(0, limit);
}
