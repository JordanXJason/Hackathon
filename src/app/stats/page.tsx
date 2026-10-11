import Link from "next/link";
import { isDay, readVisits, recentSessions, rowsInWindow, summarize, visitWindow, type RangeId, type VisitSummary } from "@/lib/analytics";
import { addDays, formatDay, shanghaiStamp, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "访问统计 · 黑客松大赛赛历",
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const PRESETS: Array<{ id: Exclude<RangeId, "custom">; label: string; href: string }> = [
  { id: "today", label: "今日", href: "/stats" },
  { id: "7", label: "近 7 天", href: "/stats?range=7" },
  { id: "30", label: "近 30 天", href: "/stats?range=30" },
  { id: "all", label: "全部", href: "/stats?range=all" },
];

function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function formatDuration(ms: number) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes < 60) return rest ? `${minutes} 分 ${rest} 秒` : `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return remain ? `${hours} 小时 ${remain} 分` : `${hours} 小时`;
}

function formatPages(value: number) {
  if (!Number.isFinite(value) || value === 0) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function pageName(path: string) {
  if (path === "/") return "赛历";
  if (path.startsWith("/event/")) return "比赛详情";
  return path;
}

function Figures({ title, summary }: { title: string; summary: VisitSummary }) {
  const items = [
    ["UV", String(summary.uv)],
    ["PV", String(summary.pv)],
    ["平均停留", formatDuration(summary.avgStayMs)],
    ["平均页数", formatPages(summary.avgPages)],
  ];
  return (
    <section>
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <div className="stats">
        {items.map(([label, value]) => (
          <div className="stat" key={label}>
            <b>{value}</b>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rangeRaw = one(params.range);
  const fromRaw = one(params.from);
  const toRaw = one(params.to);
  const custom = rangeRaw === "custom" && isDay(fromRaw) && isDay(toRaw);
  const range: RangeId = custom ? "custom" : rangeRaw === "7" || rangeRaw === "30" || rangeRaw === "all" ? rangeRaw : "today";
  const from = custom && fromRaw > toRaw ? toRaw : fromRaw;
  const to = custom && fromRaw > toRaw ? fromRaw : toRaw;
  const window = visitWindow(range, from, to);
  const rows = rowsInWindow(readVisits(), window.start, window.end);
  const sessions = recentSessions(rows);
  const today = todayISO();
  const title =
    range === "today"
      ? "今日"
      : range === "7"
        ? "近 7 天"
        : range === "30"
          ? "近 30 天"
          : range === "all"
            ? "全部"
            : `${formatDay(from)}至${formatDay(to)}`;

  return (
    <main className="page">
      <h1 className="mark">访问统计</h1>
      <p className="lede">黑客松大赛赛历的访问记录。UV 是不同访客，PV 是页面打开次数。平均停留和平均页数按一次访问计算。时间按东八区。</p>
      <div className="range">
        {PRESETS.map((preset) => (
          <Link key={preset.id} href={preset.href} aria-current={range === preset.id ? "true" : undefined}>
            {preset.label}
          </Link>
        ))}
        <form className="range-form" action={`${BASE}/stats`} method="get">
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" required defaultValue={custom ? from : addDays(today, -6)} aria-label="开始日期" />
          <span>至</span>
          <input type="date" name="to" required defaultValue={custom ? to : today} aria-label="结束日期" />
          <button type="submit">查看</button>
        </form>
      </div>
      <Figures title={title} summary={summarize(rows)} />
      <section className="recent">
        <div className="section-head">
          <h2>最近访问</h2>
          <span>单次页面停留最多记 30 分钟</span>
        </div>
        {sessions.length === 0 ? (
          <p className="empty">这一段还没有访问记录。</p>
        ) : (
          sessions.map((session) => (
            <div className="visit" key={session.sid}>
              <span>{shanghaiStamp(session.start)}</span>
              <span>{session.pages} 页</span>
              <span>{formatDuration(session.stayMs)}</span>
              <span>{pageName(session.lastPath)}</span>
            </div>
          ))
        )}
      </section>
      <p className="lede">原始记录在服务器目录 data/visits.jsonl。</p>
    </main>
  );
}
