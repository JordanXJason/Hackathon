"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { rememberList, rememberPlace } from "@/components/BackLink";
import { addDays, formatDay, monthMatrix, shanghaiStamp } from "@/lib/dates";
import { ageText, cityLabel, displayTitle, formatText, isClosed, rowFace, sortMark } from "@/lib/present";
import { AGE_GROUPS, SECTORS, type AgeGroup, type EventFormat, type EventItem, type SourceReport } from "@/lib/types";

type TimeRange = "month" | "quarter" | "half" | "year";

function compareVisible(a: EventItem, b: EventItem, today: string): number {
  const aMark = sortMark(a, today);
  const bMark = sortMark(b, today);
  if (aMark.rank !== bMark.rank) return aMark.rank - bMark.rank;
  if (aMark.date !== bMark.date) return aMark.date < bMark.date ? -1 : 1;
  return a.title.localeCompare(b.title, "zh");
}

const TIME_OPTIONS: Array<{ id: TimeRange; label: string }> = [
  { id: "month", label: "本月" },
  { id: "quarter", label: "近三月" },
  { id: "half", label: "近半年" },
  { id: "year", label: "近一年" },
];

const TIME_RANGES: TimeRange[] = ["month", "quarter", "half", "year"];
const ALL_FORMATS: EventFormat[] = ["online", "offline", "hybrid"];
const DEFAULT_AGES: AgeGroup[] = ["大学", "成年人", "未标明"];
const HIDDEN_COUNTRIES = new Set(["罗马尼亚", "印度"]);
const PAGE_SIZE = 10;

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 1 ? page : 1;
}
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

function readOne<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function readMany<T extends string>(value: string | null, allowed: readonly T[], fallback: readonly T[]): T[] {
  if (value === null) return [...fallback];
  return value.split(",").filter((item): item is T => (allowed as readonly string[]).includes(item));
}

function writeMany(params: URLSearchParams, key: string, values: readonly string[], fallback: readonly string[]) {
  const same = values.length === fallback.length && values.every((item, index) => item === fallback[index]);
  if (same) params.delete(key);
  else params.set(key, values.join(","));
}

export function Board({
  today,
  initialEvents,
  initialUpdatedAt,
  initialReport,
}: {
  today: string;
  initialEvents: EventItem[];
  initialUpdatedAt: string | null;
  initialReport: SourceReport[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [events, setEvents] = useState(initialEvents);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [report, setReport] = useState(initialReport);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const view = readOne(searchParams.get("view"), ["list", "calendar"] as const, "list");
  const timeRange = readOne(searchParams.get("time"), TIME_RANGES, "year");
  const formats = readMany(searchParams.get("format"), ALL_FORMATS, ALL_FORMATS);
  const ages = readMany(searchParams.get("ages"), AGE_GROUPS, DEFAULT_AGES);
  const sectors: string[] = readMany(searchParams.get("sectors"), SECTORS, []);
  const countryRaw = searchParams.get("country") || "全部";
  const openOnly = searchParams.get("open") === "1";
  const chinaPage = readPage(searchParams.get("cp"));
  const worldPage = readPage(searchParams.get("wp"));
  const month = /^\d{4}-\d{2}$/.test(searchParams.get("month") || "")
    ? (searchParams.get("month") as string)
    : today.slice(0, 7);

  useEffect(() => {
    rememberList();
  }, [searchParams]);

  useLayoutEffect(() => {
    const raw = sessionStorage.getItem("sai-scroll");
    if (raw == null) return;
    const top = Number(raw);
    if (!Number.isFinite(top)) return;
    const restore = () => window.scrollTo(0, top);
    restore();
    const timers = [0, 50, 150, 320].map((ms) => window.setTimeout(restore, ms));
    const clear = window.setTimeout(() => sessionStorage.removeItem("sai-scroll"), 400);
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(clear);
    };
  }, []);

  function write(mutate: (params: URLSearchParams) => void, resetPage = true) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    if (resetPage) {
      params.delete("cp");
      params.delete("wp");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const listed = useMemo(() => {
    const [year, monthNumber] = today.split("-").map(Number);
    const monthStart = `${year}-${String(monthNumber).padStart(2, "0")}-01`;
    const monthEnd = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
    const days = timeRange === "quarter" ? 90 : timeRange === "half" ? 180 : 365;
    const windowStart = timeRange === "month" ? monthStart : today;
    const windowEnd = timeRange === "month" ? monthEnd : addDays(today, days);
    return events
      .filter((event) => {
        const shown = rowFace(event, today).date || "";
        const finishes = event.end || event.deadline || event.start || "";
        const inWindow =
          timeRange === "year"
            ? (shown >= windowStart && shown <= windowEnd) ||
              (shown < windowStart && finishes >= windowStart && finishes <= windowEnd)
            : shown >= windowStart && shown <= windowEnd;
        if (!inWindow) return false;
        if (HIDDEN_COUNTRIES.has(event.country)) return false;
        if (!formats.includes(event.format)) return false;
        if (!event.ages.some((age) => ages.includes(age))) return false;
        if (sectors.length && !event.sectors.some((sector) => sectors.includes(sector))) return false;
        if (openOnly && isClosed(event, today)) return false;
        const end = event.end || event.deadline || event.start;
        if (end && end < today) return false;
        return true;
      })
      .sort((a, b) => compareVisible(a, b, today));
  }, [ages, events, formats, openOnly, sectors, timeRange, today]);

  const countries = useMemo(() => {
    const names = new Set<string>();
    for (const event of listed) {
      if (!event.country || event.country === "线上") continue;
      if (HIDDEN_COUNTRIES.has(event.country)) continue;
      names.add(event.country);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "zh"));
  }, [listed]);

  const country =
    countryRaw !== "全部" && !HIDDEN_COUNTRIES.has(countryRaw) && countries.includes(countryRaw)
      ? countryRaw
      : "全部";

  useEffect(() => {
    if (countryRaw === "全部" || country === countryRaw) return;
    write((params) => params.delete("country"));
  }, [country, countryRaw]);

  const visible = country === "全部" ? listed : listed.filter((event) => event.country === country);

  const china = visible.filter((event) => event.region === "china");
  const world = visible.filter((event) => event.region === "international");

  function setListPage(key: "cp" | "wp", page: number, anchor: string) {
    write((params) => {
      if (page <= 1) params.delete(key);
      else params.set(key, String(page));
    }, false);
    document.getElementById(anchor)?.scrollIntoView({ block: "start" });
  }

  function toggleFormat(format: EventFormat) {
    const next = formats.includes(format) ? formats.filter((item) => item !== format) : [...formats, format];
    write((params) => writeMany(params, "format", ALL_FORMATS.filter((item) => next.includes(item)), ALL_FORMATS));
  }

  function toggleAge(age: AgeGroup) {
    const next = ages.includes(age) ? ages.filter((item) => item !== age) : [...ages, age];
    write((params) => writeMany(params, "ages", AGE_GROUPS.filter((item) => next.includes(item)), DEFAULT_AGES));
  }

  function toggleSector(sector: string) {
    const next = !sector ? [] : sectors.includes(sector) ? sectors.filter((item) => item !== sector) : [...sectors, sector];
    write((params) => writeMany(params, "sectors", SECTORS.filter((item) => next.includes(item)), []));
  }

  async function refresh() {
    if (busy) return;
    setBusy(true);
    setStatus("正在全网搜索");
    try {
      const response = await fetch(`${BASE}/api/refresh`, { method: "POST" });
      if (!response.ok || !response.body) {
        setStatus(response.status === 409 ? "已有一次更新在进行" : "更新没有开始，请再按一次");
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        buffer += decoder.decode(step.value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.split("\n").find((item) => item.startsWith("data:"));
          if (!line) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            message?: string;
            error?: string;
            cache?: { events: EventItem[]; updatedAt: string; report: SourceReport[] };
          };
          if (payload.message) setStatus(payload.message === "更新完成" ? "正在全网搜索" : payload.message);
          if (payload.error) setStatus(payload.error);
          if (payload.cache) {
            setEvents(payload.cache.events);
            setReport(payload.cache.report);
            setUpdatedAt(payload.cache.updatedAt);
            setStatus("清单已更新");
          }
        }
      }
    } catch {
      setStatus("更新中断了，请再按一次");
    } finally {
      setBusy(false);
    }
  }

  const updatedLabel = updatedAt ? `上次更新 ${shanghaiStamp(updatedAt)}` : "还没有抓取过";

  return (
    <main className="page">
      <header className="top">
        <div>
          <h1 className="mark">黑客松大赛赛历</h1>
          <p className="lede">未来一年的黑客松和 AI 比赛。{updatedLabel}</p>
        </div>
        <div className="actions">
          <div className="view-switch" role="group" aria-label="查看方式">
            <button
              type="button"
              aria-pressed={view === "list"}
              onClick={() => write((params) => params.delete("view"), false)}
            >
              清单
            </button>
            <button
              type="button"
              aria-pressed={view === "calendar"}
              onClick={() => write((params) => params.set("view", "calendar"), false)}
            >
              日历
            </button>
          </div>
          <button type="button" className="refresh" data-busy={busy ? "true" : "false"} disabled={busy} onClick={refresh}>
            {busy ? "正在全网搜索" : "更新全部"}
          </button>
        </div>
      </header>
      {status ? (
        <p className="status-line" role="status">
          {status}
        </p>
      ) : null}
      <Filters
        timeRange={timeRange}
        formats={formats}
        ages={ages}
        sectors={sectors}
        country={country}
        countries={countries}
        openOnly={openOnly}
        onTime={(value) =>
          write((params) => {
            if (value === "year") params.delete("time");
            else params.set("time", value);
          })
        }
        onFormat={toggleFormat}
        onAge={toggleAge}
        onSector={toggleSector}
        onCountry={(value) =>
          write((params) => {
            if (value === "全部") params.delete("country");
            else params.set("country", value);
          })
        }
        onOpenOnly={(value) =>
          write((params) => {
            if (value) params.set("open", "1");
            else params.delete("open");
          })
        }
      />
      {report.length > 0 && (
        <div className="report">
          <span className="filter-label">来源</span>
          {report
            .filter((row) => row.error || row.kept > 0)
            .map((row) => (
              <span key={row.source} className={row.error ? "bad" : undefined} title={row.error || ""}>
                {row.source} {row.error ? "拒绝访问" : row.kept}
              </span>
            ))}
        </div>
      )}
      {view === "list" ? (
        <div key={searchParams.toString()} className="list">
          <Section
            title="中国区"
            anchor="china-list"
            events={china}
            page={chinaPage}
            today={today}
            activeSectors={sectors}
            onPage={(next) => setListPage("cp", next, "china-list")}
          />
          <Section
            title="国际区"
            anchor="world-list"
            events={world}
            page={worldPage}
            today={today}
            activeSectors={sectors}
            onPage={(next) => setListPage("wp", next, "world-list")}
          />
        </div>
      ) : (
        <Calendar
          events={visible}
          today={today}
          activeSectors={sectors}
          cursor={month}
          onCursor={(next) =>
            write((params) => {
              if (next === today.slice(0, 7)) params.delete("month");
              else params.set("month", next);
            }, false)
          }
        />
      )}
    </main>
  );
}

function Filters(props: {
  timeRange: TimeRange;
  formats: EventFormat[];
  ages: AgeGroup[];
  sectors: string[];
  country: string;
  countries: string[];
  openOnly: boolean;
  onTime: (value: TimeRange) => void;
  onFormat: (value: EventFormat) => void;
  onAge: (value: AgeGroup) => void;
  onSector: (value: string) => void;
  onCountry: (value: string) => void;
  onOpenOnly: (value: boolean) => void;
}) {
  return (
    <section className="filters" aria-label="筛选">
      <div className="filter-row">
        <span className="filter-label">时间</span>
        <div className="time-switch">
          {TIME_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={props.timeRange === option.id}
              onClick={() => props.onTime(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="check">
          <input
            type="checkbox"
            checked={props.openOnly}
            onChange={(event) => props.onOpenOnly(event.target.checked)}
          />
          只看报名中
        </label>
      </div>
      <div className="filter-row">
        <span className="filter-label">形式</span>
        {(
          [
            ["online", "线上"],
            ["offline", "线下"],
            ["hybrid", "线上 + 线下"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="chip"
            aria-pressed={props.formats.includes(value)}
            onClick={() => props.onFormat(value)}
          >
            {label}
          </button>
        ))}
        <span className="country-field">
          <label className="filter-label" htmlFor="country">
            国家
          </label>
          <select
            id="country"
            className="country-select"
            value={props.country}
            onChange={(event) => props.onCountry(event.target.value)}
          >
            <option>全部</option>
            {props.countries.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </span>
      </div>
      <div className="filter-row">
        <span className="filter-label">年龄</span>
        {AGE_GROUPS.map((age) => (
          <label key={age} className="check">
            <input type="checkbox" checked={props.ages.includes(age)} onChange={() => props.onAge(age)} />
            {age === "未标明" ? "年龄未标明" : age}
          </label>
        ))}
      </div>
      <div className="filter-row">
        <span className="filter-label">板块</span>
        <button type="button" className="chip" aria-pressed={props.sectors.length === 0} onClick={() => props.onSector("")}>
          全部
        </button>
        {SECTORS.map((sector) => (
          <button
            key={sector}
            type="button"
            className="chip"
            aria-pressed={props.sectors.includes(sector)}
            onClick={() => props.onSector(sector)}
          >
            {sector}
          </button>
        ))}
      </div>
    </section>
  );
}

function Section({
  title,
  anchor,
  events,
  page,
  today,
  activeSectors,
  onPage,
}: {
  title: string;
  anchor: string;
  events: EventItem[];
  page: number;
  today: string;
  activeSectors: string[];
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(events.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const slice = events.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  return (
    <section className="section" id={anchor}>
      <div className="section-head">
        <h2>{title}</h2>
        <span>{events.length} 场</span>
      </div>
      {slice.length === 0 ? (
        <p className="empty">这个筛选下没有比赛。</p>
      ) : (
        slice.map((event) => (
          <EventRow key={event.id} event={event} today={today} activeSectors={activeSectors} />
        ))
      )}
      {pages > 1 ? (
        <nav className="pager" aria-label={`${title}分页`}>
          <button type="button" disabled={current <= 1} onClick={() => onPage(current - 1)}>
            上一页
          </button>
          <span>
            {current} / {pages}
          </span>
          <button type="button" disabled={current >= pages} onClick={() => onPage(current + 1)}>
            下一页
          </button>
        </nav>
      ) : null}
    </section>
  );
}

function EventRow({ event, today, activeSectors }: { event: EventItem; today: string; activeSectors: string[] }) {
  const face = rowFace(event, today);
  const sectors = [
    ...event.sectors.filter((sector) => activeSectors.includes(sector)),
    ...event.sectors.filter((sector) => !activeSectors.includes(sector)),
  ].slice(0, 2);
  const meta = [event.kind, ageText(event.ages), ...sectors].filter(Boolean).join(" · ");
  const where = cityLabel(event);
  return (
    <Link className="row" href={`/event/${event.id}`} title={event.title} onClick={() => rememberPlace(event.id)}>
      <span className="when">
        <strong className={face.urgent ? "urgent" : undefined}>{formatDay(face.date)}</strong>
        <span className={face.urgent ? "urgent" : undefined}>{face.label}</span>
      </span>
      <span className="titles">
        <b>{displayTitle(event.title)}</b>
        {event.titleZh ? <em>{displayTitle(event.titleZh)}</em> : null}
      </span>
      <span className="where">
        <span className={`badge ${event.format}`}>{formatText(event.format)}</span>
        {event.format !== "online" && where ? <span className="place">{where}</span> : null}
      </span>
      <span className="tags">{meta}</span>
    </Link>
  );
}

function Calendar({
  events,
  today,
  activeSectors,
  cursor,
  onCursor,
}: {
  events: EventItem[];
  today: string;
  activeSectors: string[];
  cursor: string;
  onCursor: (next: string) => void;
}) {
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [picked, setPicked] = useState<string | null>(null);
  const [year, month] = cursor.split("-").map(Number);
  const cells = monthMatrix(year, month);
  const byDay = new Map<string, EventItem[]>();
  for (const event of events) {
    const days = spanDays(event, year, month);
    for (const day of days) {
      const list = byDay.get(day) ?? [];
      list.push(event);
      byDay.set(day, list);
    }
  }
  const days = [...byDay.keys()].sort();
  if (picked && !days.includes(picked)) days.push(picked);
  days.sort();

  function move(step: number) {
    const next = new Date(Date.UTC(year, month - 1 + step, 1));
    setDirection(step > 0 ? "next" : "prev");
    onCursor(next.toISOString().slice(0, 7));
    setPicked(null);
  }

  function choose(day: string) {
    setPicked(day);
  }

  useEffect(() => {
    if (!picked) return;
    document.getElementById(`cal-${picked}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [picked]);

  return (
    <section className="calendar">
      <div className="cal-head">
        <button type="button" onClick={() => move(-1)} aria-label="上个月">
          ‹
        </button>
        <h2>
          {year}年{month}月
        </h2>
        <button type="button" onClick={() => move(1)} aria-label="下个月">
          ›
        </button>
      </div>
      <div className="weekdays">
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <p className="cal-note">日期下的数字是这一天有几场比赛。点某一天，下面的清单会跳到那一天。</p>
      <div key={cursor} className={`grid slide-${direction}`}>
        {cells.map((day, index) => {
          const items = day ? byDay.get(day) ?? [] : [];
          const urgent = items.some((event) => rowFace(event, today).urgent);
          return (
            <div
              className={["day", day && day === picked ? "is-picked" : ""].filter(Boolean).join(" ")}
              key={day ?? `empty-${index}`}
              onClick={() => day && choose(day)}
            >
              {day && (
                <>
                  <button
                    type="button"
                    className={["num", urgent ? "urgent-num" : "", day === today ? "is-today" : ""].filter(Boolean).join(" ")}
                    aria-current={day === today ? "date" : undefined}
                    aria-pressed={day === picked}
                    onClick={(event) => {
                      event.stopPropagation();
                      choose(day);
                    }}
                  >
                    {Number(day.slice(8))}
                  </button>
                  {items.length > 0 ? (
                    <span className="day-count" title={`这一天有 ${items.length} 场比赛`}>
                      {items.length}场
                    </span>
                  ) : null}
                  <div className="pills">
                    {items.slice(0, 3).map((event) => (
                      <Link
                        key={event.id}
                        href={`/event/${event.id}`}
                        className={rowFace(event, today).urgent ? "pill urgent" : "pill"}
                        title={event.title}
                        onClick={(click) => {
                          click.stopPropagation();
                          rememberPlace(event.id);
                        }}
                      >
                        {formatText(event.format)} {displayTitle(event.title)}
                      </Link>
                    ))}
                    {items.length > 3 && (
                      <button
                        type="button"
                        className="more"
                        onClick={(event) => {
                          event.stopPropagation();
                          choose(day);
                        }}
                      >
                        还有 {items.length - 3} 场
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="day-list">
        {days.length === 0 ? (
          <p className="empty">这个月没有比赛。</p>
        ) : (
          days.map((day) => {
            const items = byDay.get(day) ?? [];
            return (
              <div className="day-block" id={`cal-${day}`} key={day}>
                <div className="section-head">
                  <h2>{formatDay(day)}</h2>
                  <span>{items.length} 场</span>
                </div>
                {items.length === 0 ? (
                  <p className="empty">这一天没有比赛。</p>
                ) : (
                  items.map((event) => (
                    <EventRow key={event.id} event={event} today={today} activeSectors={activeSectors} />
                  ))
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function spanDays(event: EventItem, year: number, month: number): string[] {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const start = event.start;
  const end = event.end || event.deadline;
  const short = !!(start && end && end <= addDays(start, 4));
  if (short && start && end) {
    const from = start > monthStart ? start : monthStart;
    const to = end < monthEnd ? end : monthEnd;
    if (from > to) return [];
    const days: string[] = [];
    let cursor = from;
    while (cursor <= to && days.length < 6) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }
  const points = [event.deadline, start, end].filter((point): point is string => !!point && point >= monthStart && point <= monthEnd);
  if (points.length) return [points[0]];
  return [];
}
