import { recentSessions, readVisits, summarize, type VisitSummary } from "@/lib/analytics";
import { shanghaiStamp, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "访问统计 · 黑客松大赛赛历",
};

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

export default function StatsPage() {
  const rows = readVisits();
  const dayStart = new Date(`${todayISO()}T00:00:00+08:00`).toISOString();
  const todayRows = rows.filter((row) => row.t >= dayStart);
  const sessions = recentSessions(rows);

  return (
    <main className="page">
      <h1 className="mark">访问统计</h1>
      <p className="lede">黑客松大赛赛历的访问记录。UV 是不同访客，PV 是页面打开次数。平均停留和平均页数按一次访问计算。</p>
      <Figures title="今日" summary={summarize(todayRows)} />
      <Figures title="累计" summary={summarize(rows)} />
      <section className="recent">
        <div className="section-head">
          <h2>最近访问</h2>
          <span>单次页面停留最多记 30 分钟</span>
        </div>
        {sessions.length === 0 ? (
          <p className="empty">还没有访问记录。</p>
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
