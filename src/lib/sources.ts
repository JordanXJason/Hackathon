import { inferFormat } from "./classify";
import { fromUnix, parseEnglishRange } from "./dates";
import { fetchJson, fetchText, plainText, stripHtml } from "./http";
import type { EventDraft, EventFormat, SourceReport } from "./types";
import countryMap from "./doraCountries.json";

const countryIds = countryMap as Record<string, string>;

export interface SourcePull {
  source: string;
  drafts: EventDraft[];
  upstream: number | null;
  error?: string;
}

const GREATER_CHINA_IDS = new Set(["42", "92", "210"]);

function draft(partial: EventDraft): EventDraft {
  return partial;
}

function empty(source: string, error: string): SourcePull {
  return { source, drafts: [], upstream: null, error };
}

export async function pullDevpost(): Promise<SourcePull> {
  const source = "Devpost";
  const drafts: EventDraft[] = [];
  let upstream: number | null = null;
  try {
    for (let page = 1; page <= 8; page += 1) {
      const url = `https://devpost.com/api/hackathons?order_by=submission_deadline&status[]=open&status[]=upcoming&per_page=40&page=${page}`;
      const data = await fetchJson<{
        hackathons: Array<{
          title: string;
          displayed_location?: { location?: string; icon?: string };
          url: string;
          submission_period_dates?: string;
          themes?: Array<{ name: string }>;
          prize_amount?: string;
          organization_name?: string;
          open_state?: string;
        }>;
        meta?: { total_count?: number };
      }>(url);
      upstream = data.meta?.total_count ?? upstream;
      if (!data.hackathons?.length) break;
      for (const item of data.hackathons) {
        const range = parseEnglishRange(item.submission_period_dates || "");
        const location = item.displayed_location?.location || "";
        const online = item.displayed_location?.icon === "globe" || /online/i.test(location);
        drafts.push(
          draft({
            title: item.title,
            start: range.start,
            end: range.end,
            deadline: range.end,
            deadlineKind: range.end ? "submission" : "unknown",
            format: online ? "online" : location ? "offline" : "online",
            city: online ? "线上" : location,
            country: "",
            organizer: item.organization_name || "",
            prize: stripHtml(item.prize_amount || ""),
            summary: "",
            url: item.url,
            registrationUrl: item.url,
            hint: (item.themes || []).map((theme) => theme.name).join(" "),
            source,
          }),
        );
      }
      if (data.hackathons.length < 40) break;
    }
    return { source, drafts, upstream };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

interface MlhEvent {
  name: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  formatType?: string;
  websiteUrl?: string;
  url?: string;
  customFields?: { underserved_types?: string[] };
  venueAddress?: { city?: string; country?: string };
}

export async function pullMlh(): Promise<SourcePull> {
  const source = "MLH";
  try {
    const html = await fetchText("https://www.mlh.com/seasons/2027/events");
    const match = html.match(/"upcomingEvents":(\[[\s\S]*?\]),"pastEvents"/);
    if (!match) return empty(source, "页面里没有 upcomingEvents");
    const events = JSON.parse(match[1].replace(/\\\//g, "/")) as MlhEvent[];
    const drafts = events.map((item) => {
      const start = item.startsAt?.slice(0, 10) ?? null;
      const end = item.endsAt?.slice(0, 10) ?? null;
      const format = inferFormat(item.formatType || "", item.location || "");
      const city = item.venueAddress?.city || (format === "online" ? "线上" : item.location || "");
      return draft({
        title: item.name,
        start,
        end,
        deadline: null,
        deadlineKind: "unknown",
        format,
        city,
        country: item.venueAddress?.country || "",
        organizer: "Major League Hacking",
        prize: "",
        summary: "",
        url: item.websiteUrl || `https://mlh.io${item.url || ""}`,
        registrationUrl: item.websiteUrl || `https://mlh.io${item.url || ""}`,
        hint: (item.customFields?.underserved_types || []).join(" "),
        source,
      });
    });
    return { source, drafts, upstream: events.length };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

interface DoraEvent {
  uname: string;
  title: string;
  timeline_start?: number;
  timeline_end?: number;
  timeline_pre_register?: number | null;
  venue_form?: string;
  venue_country_id?: number | null;
  venue_name?: string | null;
  venue_address?: string | null;
  bonus_price?: number;
  bonus_token?: string;
  owner?: { name?: string };
  tags?: string;
  ecosystem?: string;
}

export async function pullDora(): Promise<SourcePull> {
  const source = "DoraHacks";
  const drafts: EventDraft[] = [];
  try {
    let upstream: number | null = null;
    for (let page = 1; page <= 20; page += 1) {
      const data = await fetchJson<{
        count?: number;
        results?: DoraEvent[];
        next?: string | null;
      }>(`https://dorahacks.io/api/v1/hub/hackathons?page=${page}&page_size=100`);
      upstream = data.count ?? upstream;
      for (const item of data.results || []) {
        const start = fromUnix(item.timeline_start);
        const end = fromUnix(item.timeline_end);
        const marker = fromUnix(item.timeline_pre_register);
        let deadline: string | null = null;
        let deadlineKind: EventDraft["deadlineKind"] = "unknown";
        if (marker && start && end && marker >= start && marker <= end) {
          deadline = marker;
          deadlineKind = "submission";
        } else if (marker && start && marker < start) {
          deadline = start;
          deadlineKind = "registration";
        }
        const countryId = item.venue_country_id ? String(item.venue_country_id) : "";
        const country = countryIds[countryId] || "";
        const format: EventFormat = inferFormat(item.venue_form || "", "");
        const city =
          format === "online"
            ? "线上"
            : item.venue_name || item.venue_address || (GREATER_CHINA_IDS.has(countryId) ? country : country);
        drafts.push(
          draft({
            title: item.title,
            start,
            end,
            deadline,
            deadlineKind,
            format,
            city: city || "",
            country: GREATER_CHINA_IDS.has(countryId) ? "中国" : country,
            organizer: item.owner?.name || "",
            prize: item.bonus_price ? `${item.bonus_price} ${item.bonus_token || ""}`.trim() : "",
            summary: "",
            url: `https://dorahacks.io/hackathon/${item.uname}`,
            registrationUrl: `https://dorahacks.io/hackathon/${item.uname}`,
            hint: `${item.tags || ""} ${item.ecosystem || ""} ${item.venue_form || ""}`,
            source,
          }),
        );
      }
      if (!data.next || !(data.results || []).length) break;
    }
    return { source, drafts, upstream };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

interface TripEvent {
  name: string;
  city?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  mode?: string;
  format?: string;
  status?: string;
  summary?: string;
  description?: string;
  prizePool?: string;
  hostOrganizer?: string;
  website?: string;
  registrationDeadline?: string | null;
  registration?: { url?: string };
  slug?: string;
  id?: string;
  theme?: string;
  tracks?: Array<{ title?: string }>;
  isPast?: boolean;
}

export async function pullHackerTrip(): Promise<SourcePull> {
  const source = "HackerTrip";
  try {
    const data = await fetchJson<TripEvent[]>("https://hackertrip.space/api/hackathons");
    const drafts = data
      .filter((item) => item.status !== "closed" && !item.isPast)
      .map((item) => {
        const format = inferFormat(item.mode || item.format || "", item.city || "");
        return draft({
          title: item.name,
          start: item.startDate?.slice(0, 10) ?? null,
          end: item.endDate?.slice(0, 10) ?? null,
          deadline: item.registrationDeadline?.slice(0, 10) ?? null,
          deadlineKind: item.registrationDeadline ? "registration" : "unknown",
          format,
          city: format === "online" ? item.city || "线上" : item.city || "",
          country: item.country || "",
          organizer: item.hostOrganizer || "",
          prize: item.prizePool || "",
          summary: plainText(item.summary || item.description || ""),
          url: item.website || `https://hackertrip.space/hackathon/${item.slug || item.id}`,
          registrationUrl: item.registration?.url || item.website || `https://hackertrip.space/hackathon/${item.slug || item.id}`,
          hint: `${item.theme || ""} ${(item.tracks || []).map((track) => track.title || "").join(" ")}`,
          source,
        });
      });
    return { source, drafts, upstream: data.length };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

export async function pullEthGlobal(): Promise<SourcePull> {
  const source = "ETHGlobal";
  try {
    const html = await fetchText("https://ethglobal.com/events");
    const pattern =
      /href="([^"]+)"[\s\S]{0,700}?<h3[^>]*>([^<]+)<\/h3>[\s\S]{0,500}?<time[^>]*>([^<]*)<\/time>(?:\s*[–—-]\s*<time[^>]*>([^<]*)<\/time>)?[\s\S]{0,400}?uppercase[^>]*>([^<]+)</g;
    const drafts: EventDraft[] = [];
    const seen = new Set<string>();
    for (const match of html.matchAll(pattern)) {
      const kind = stripHtml(match[5]);
      if (!/hackathon/i.test(kind)) continue;
      const title = stripHtml(match[2]);
      if (seen.has(title)) continue;
      seen.add(title);
      const range = parseEnglishRange(
        match[4] ? `${stripHtml(match[3])} - ${stripHtml(match[4])}` : stripHtml(match[3]),
      );
      const href = match[1].startsWith("http") ? match[1] : `https://ethglobal.com${match[1]}`;
      drafts.push(
        draft({
          title,
          start: range.start,
          end: range.end,
          deadline: null,
          deadlineKind: "unknown",
          format: "offline",
          city: "",
          country: "",
          organizer: "ETHGlobal",
          prize: "",
          summary: "",
          url: href,
          registrationUrl: href,
          hint: "Web3 hackathon",
          source,
        }),
      );
    }
    if (!drafts.length) return empty(source, "页面结构变了，没有解析到黑客松");
    return { source, drafts, upstream: drafts.length };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

export async function pullDrivenData(): Promise<SourcePull> {
  const source = "DrivenData";
  try {
    const html = await fetchText("https://www.drivendata.org/competitions/");
    const pattern = /<h3[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
    const drafts: EventDraft[] = [];
    for (const match of html.matchAll(pattern)) {
      const title = stripHtml(match[2]);
      const href = match[1].startsWith("http") ? match[1] : `https://www.drivendata.org${match[1]}`;
      drafts.push(
        draft({
          title,
          start: null,
          end: null,
          deadline: null,
          deadlineKind: "unknown",
          format: "online",
          city: "线上",
          country: "线上",
          organizer: "DrivenData",
          prize: "",
          summary: "",
          url: href,
          registrationUrl: href,
          hint: "data science AI competition",
          source,
        }),
      );
    }
    const active = drafts.filter((item) => !/winners|completed|past/i.test(item.title));
    if (!active.length) return empty(source, "没有解析到进行中的比赛");
    return { source, drafts: active, upstream: active.length };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

export async function pullLablab(): Promise<SourcePull> {
  const source = "lablab.ai";
  try {
    const html = await fetchText("https://lablab.ai/ai-hackathons");
    const pattern = /<h[23][^>]*>([^<]{6,140})<\/h[23]>/g;
    const drafts: EventDraft[] = [];
    const seen = new Set<string>();
    for (const match of html.matchAll(pattern)) {
      const title = stripHtml(match[1]);
      if (!/hackathon|challenge|sprint/i.test(title) || seen.has(title)) continue;
      seen.add(title);
      drafts.push(
        draft({
          title,
          start: null,
          end: null,
          deadline: null,
          deadlineKind: "unknown",
          format: "online",
          city: "线上",
          country: "线上",
          organizer: "lablab.ai",
          prize: "",
          summary: "",
          url: "https://lablab.ai/ai-hackathons",
          registrationUrl: "https://lablab.ai/ai-hackathons",
          hint: "AI hackathon",
          source,
        }),
      );
    }
    if (!drafts.length) return empty(source, "页面没有可解析的赛事标题");
    return { source, drafts, upstream: drafts.length };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

export async function pullModelScope(): Promise<SourcePull> {
  const source = "魔搭";
  try {
    const drafts: EventDraft[] = [];
    let total = 0;
    for (let page = 1; page <= 20; page += 1) {
      const data = await fetchJson<{
        Data?: {
          TotalCount?: number;
          Races?: Array<Record<string, unknown>>;
        };
      }>(`https://www.modelscope.cn/api/v1/competitions?page=${page}`);
      const races = data.Data?.Races || [];
      total = data.Data?.TotalCount || total;
      for (const item of races) {
        const parsed = modelScopeDraft(item);
        if (parsed) drafts.push(parsed);
      }
      if (!races.length || page * 10 >= total) break;
    }
    return { source, drafts, upstream: total || drafts.length };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

function modelScopeDraft(item: Record<string, unknown>): EventDraft | null {
  const title = typeof item.Title === "string" ? item.Title.trim() : "";
  if (!title) return null;
  const deadline = fromUnix(typeof item.RegistrationDeadline === "number" ? item.RegistrationDeadline : null);
  const start = fromUnix(typeof item.SignUpStart === "number" ? item.SignUpStart : null);
  const endValue = fromUnix(typeof item.EndTime === "number" ? item.EndTime : null);
  const end = endValue || deadline;
  const organizers = Array.isArray(item.OrganizerInfo)
    ? item.OrganizerInfo.map((org) => (isRecord(org) && typeof org.Name === "string" ? org.Name : "")).filter(Boolean)
    : [];
  const signup = typeof item.SignUpUrl === "string" ? item.SignUpUrl : "";
  const id = item.Id;
  const url = signup || (id ? `https://www.modelscope.cn/competition/${id}` : "https://www.modelscope.cn/competition");
  const location = typeof item.EventLocation === "string" ? item.EventLocation.trim() : "";
  const brief = typeof item.Brief === "string" ? item.Brief : "";
  const category = typeof item.Category === "string" ? item.Category : "";
  const blob = `${title} ${brief} ${category}`;
  if (/指南|资源获取|说明会/.test(title)) return null;
  if (/大会|论坛|峰会|沙龙/.test(title) && !/黑客松|挑战赛|竞赛|大赛/.test(title)) return null;
  if (!/黑客松|挑战赛|竞赛|大赛|hackathon|hackfest/i.test(blob)) return null;
  return draft({
    title,
    start,
    end,
    deadline,
    deadlineKind: deadline ? "registration" : "unknown",
    format: inferFormat(location, location),
    city: location || "线上",
    country: "中国",
    organizer: organizers.join("、"),
    prize: typeof item.BonusDesc === "string" ? item.BonusDesc : "",
    summary: plainText(brief),
    url,
    registrationUrl: url,
    hint: `${typeof item.Category === "string" ? item.Category : ""} ${brief}`,
    source: "魔搭",
  });
}

export async function pullTianchi(): Promise<SourcePull> {
  const source = "天池";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch("https://tianchi.aliyun.com/competition/proxy/api/competition/api/race/list", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ pageNum: 1, pageSize: 50, keyword: "", raceType: "" }),
    });
    clearTimeout(timer);
    if (!res.ok) return empty(source, `HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    const list = findList(data);
    const drafts = list
      .map((item) => competitionDraft(item, source, "https://tianchi.aliyun.com/competition/"))
      .filter((item): item is EventDraft => !!item);
    if (!drafts.length) return empty(source, "接口没有可解析的赛事");
    return { source, drafts, upstream: drafts.length };
  } catch (error) {
    return empty(source, error instanceof Error ? error.message : "抓取失败");
  }
}

function findList(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  for (const key of ["Data", "data", "results", "list", "races", "Competitions", "competitions"]) {
    const value = data[key];
    if (Array.isArray(value)) return value.filter(isRecord);
    if (isRecord(value)) {
      const nested = findList(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pickString(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function competitionDraft(item: Record<string, unknown>, source: string, fallbackUrl: string): EventDraft | null {
  const title = pickString(item, ["Name", "name", "title", "raceName", "Title"]);
  if (!title) return null;
  const url = pickString(item, ["Url", "url", "website", "link"]) || fallbackUrl;
  const start = pickString(item, ["StartTime", "startTime", "gmtStart", "start"]).slice(0, 10) || null;
  const end = pickString(item, ["EndTime", "endTime", "gmtEnd", "end"]).slice(0, 10) || null;
  return draft({
    title,
    start: start && start.includes("-") ? start : null,
    end: end && end.includes("-") ? end : null,
    deadline: end && end.includes("-") ? end : null,
    deadlineKind: end ? "registration" : "unknown",
    format: "online",
    city: "线上",
    country: "中国",
    organizer: pickString(item, ["Organizer", "organizer", "sponsor"]) || source,
    prize: pickString(item, ["Prize", "prize", "bonus"]),
    summary: plainText(pickString(item, ["Description", "description", "brief"])),
    url,
    registrationUrl: url,
    hint: `${pickString(item, ["Tag", "tags", "category"])} AI`,
    source,
  });
}

export async function pullAll(onProgress: (message: string) => void): Promise<SourcePull[]> {
  const jobs: Array<{ name: string; run: () => Promise<SourcePull> }> = [
    { name: "HackerTrip", run: pullHackerTrip },
    { name: "Devpost", run: pullDevpost },
    { name: "MLH", run: pullMlh },
    { name: "DoraHacks", run: pullDora },
    { name: "ETHGlobal", run: pullEthGlobal },
    { name: "DrivenData", run: pullDrivenData },
    { name: "lablab.ai", run: pullLablab },
    { name: "魔搭", run: pullModelScope },
    { name: "天池", run: pullTianchi },
  ];
  onProgress("正在全网搜索");
  const pulls = await Promise.all(
    jobs.map(async (job) => {
      onProgress(`正在抓取 ${job.name}`);
      return job.run();
    }),
  );
  return pulls;
}

export function reportOf(pull: SourcePull, kept: number): SourceReport {
  return {
    source: pull.source,
    fetched: pull.drafts.length,
    upstream: pull.upstream,
    kept,
    error: pull.error,
  };
}
