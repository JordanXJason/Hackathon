import type { AgeGroup, EventDraft, EventFormat, EventItem, EventKind, Region } from "./types";

const GREATER_CHINA = new Set(["中国", "中国大陆", "香港", "澳门", "台湾", "中国香港", "中国澳门", "中国台湾"]);

const COUNTRY_ZH: Record<string, string> = {
  china: "中国",
  "china mainland": "中国",
  "hong kong": "香港",
  macau: "澳门",
  macao: "澳门",
  taiwan: "台湾",
  "united states": "美国",
  usa: "美国",
  us: "美国",
  cn: "中国",
  ca: "加拿大",
  gb: "英国",
  in: "印度",
  mx: "墨西哥",
  ro: "罗马尼亚",
  es: "西班牙",
  de: "德国",
  fr: "法国",
  jp: "日本",
  kr: "韩国",
  sg: "新加坡",
  au: "澳大利亚",
  nl: "荷兰",
  br: "巴西",
  "united kingdom": "英国",
  uk: "英国",
  india: "印度",
  canada: "加拿大",
  germany: "德国",
  france: "法国",
  japan: "日本",
  "south korea": "韩国",
  korea: "韩国",
  singapore: "新加坡",
  australia: "澳大利亚",
  netherlands: "荷兰",
  brazil: "巴西",
  indonesia: "印度尼西亚",
  vietnam: "越南",
  thailand: "泰国",
  malaysia: "马来西亚",
  spain: "西班牙",
  italy: "意大利",
  switzerland: "瑞士",
  sweden: "瑞典",
  israel: "以色列",
  uae: "阿联酋",
  "united arab emirates": "阿联酋",
  worldwide: "全球",
};

const CHINA_ORGS =
  /阿里|天猫|蚂蚁|腾讯|华为|百度|字节|抖音|快手|安克|小米|京东|美团|网易|商汤|科大讯飞|飞桨|魔搭|天池|支付宝|开源社|拼多多|滴滴|联想|大疆|理想|蔚来|小红书|哔哩|bilibili|oppo|vivo/i;

const BIG_TECH =
  /阿里|天猫|蚂蚁|腾讯|华为|百度|字节|快手|安克|小米|京东|美团|网易|商汤|科大讯飞|飞桨|魔搭|天池|支付宝|amazon|google|microsoft|nvidia|meta|apple|openai|anthropic|intel|amd|samsung|oracle|ibm|adobe/i;

const CHINA_CITIES =
  /北京|上海|广州|深圳|杭州|成都|重庆|南京|武汉|西安|苏州|厦门|青岛|天津|长沙|合肥|福州|济南|大连|沈阳|长春|哈尔滨|昆明|郑州|东莞|佛山|珠海|宁波|无锡|香港|澳门|台北|新竹|高雄/;

export function countryName(raw: string): string {
  const text = raw.trim();
  if (!text || /^(online|virtual|remote|线上)$/i.test(text)) return "";
  const mapped = COUNTRY_ZH[text.toLowerCase()];
  if (mapped) return mapped;
  if (GREATER_CHINA.has(text)) return text === "中国大陆" ? "中国" : text;
  return text;
}

export function inferRegion(draft: EventDraft): Region {
  const country = countryName(draft.country);
  const blob = `${draft.city} ${draft.organizer} ${draft.title} ${draft.hint}`;
  if (GREATER_CHINA.has(country) || CHINA_CITIES.test(draft.city) || CHINA_ORGS.test(blob)) return "china";
  return "international";
}

export function inferAges(draft: EventDraft): AgeGroup[] {
  const blob = `${draft.title} ${draft.summary} ${draft.hint}`.toLowerCase();
  const ages = new Set<AgeGroup>();
  if (/小学|小学生|elementary|primary school/.test(blob)) ages.add("小学");
  if (/初中|junior high|middle school/.test(blob)) ages.add("初中");
  if (/高中|high school|中学生/.test(blob)) ages.add("高中");
  if (/大学|高校|大学生|undergraduate|university|college students?/.test(blob)) ages.add("大学");
  if (/成人|职场|professionals?|18\+/.test(blob)) ages.add("成年人");
  if (/中小学/.test(blob)) {
    ages.add("小学");
    ages.add("初中");
    ages.add("高中");
  }
  if (/青少年/.test(blob) && ages.size === 0) {
    ages.add("小学");
    ages.add("初中");
    ages.add("高中");
  }
  if (/不限年龄|all ages|任何年龄/.test(blob)) {
    (["小学", "初中", "高中", "大学", "成年人"] as AgeGroup[]).forEach((age) => ages.add(age));
  }
  if (ages.size === 0) ages.add("未标明");
  return AGE_ORDER.filter((age) => ages.has(age));
}

const AGE_ORDER: AgeGroup[] = ["小学", "初中", "高中", "大学", "成年人", "未标明"];

export function inferSectors(draft: EventDraft, ages: AgeGroup[]): string[] {
  const blob = `${draft.title} ${draft.summary} ${draft.hint} ${draft.organizer}`.toLowerCase();
  const sectors: string[] = [];
  const add = (name: string, ok: boolean) => {
    if (ok && !sectors.includes(name)) sectors.push(name);
  };
  add("AI", /人工智能|\bai\b|大模型|机器学习|machine learning|智能体|agent|生成式|aigc/.test(blob));
  add("硬件", /硬件|hardware|芯片|嵌入式|iot|开发板|传感器/.test(blob));
  add("机器人", /机器人|具身|robot/.test(blob));
  add("医疗", /医疗|健康|生物|医药|health|medical|bio/.test(blob));
  add("Web3", /web3|区块链|crypto|ethereum|solana|链上/.test(blob));
  add("开源", /开源|open source/.test(blob));
  add("安全", /安全|security|渗透|\bctf\b/.test(blob));
  add("游戏", /游戏|game/.test(blob));
  add("学生", ages.some((age) => age !== "成年人" && age !== "未标明") || /学生|student|青少年|高校/.test(blob));
  add("大厂", BIG_TECH.test(`${draft.organizer} ${draft.title}`));
  return sectors;
}

export function inferKind(draft: EventDraft, sectors: string[]): EventKind {
  const blob = `${draft.title} ${draft.hint} ${draft.source}`.toLowerCase();
  if (/kaggle|drivendata|aicrowd|数据科学|算法赛/.test(blob)) return "线上数据赛";
  if (/机器人/.test(blob) && !/黑客松|hackathon/.test(blob)) return "机器人赛";
  if (/青少年/.test(blob) && /挑战赛|竞赛|大赛/.test(blob) && !/黑客松|hackathon/.test(blob)) {
    return "青少年学科竞赛";
  }
  if (/黑客松|hackathon|hackfest|hack week|ハッカソン|해커톤/.test(blob)) return "黑客松";
  if (sectors.includes("AI") || /创新大赛|创新挑战|challenge/.test(blob)) return "AI创新大赛";
  return "黑客松";
}

export function inferFormat(raw: string, city: string): EventFormat {
  const text = `${raw} ${city}`.toLowerCase();
  const online = /online|virtual|digital|remote|线上|远程|everywhere|worldwide/.test(text);
  const offline = /offline|in-person|in person|physical|onsite|on-site|线下|到场/.test(text);
  if (/hybrid|混合/.test(text) || (online && offline)) return "hybrid";
  if (online && !offline) return "online";
  if (offline && !online) return "offline";
  if (/线上/.test(city) || city.toLowerCase() === "online") return "online";
  if (city.trim()) return "offline";
  return "online";
}

export function hasChinese(text: string): boolean {
  const chars = text.match(/[\u4e00-\u9fff]/g);
  return !!chars && chars.length >= 2;
}

function shortPlace(city: string): string {
  const text = city.replace(/\s+/g, " ").trim();
  if (text.length <= 18) return text;
  const cut = text.split(/[·（(，,]/)[0].trim();
  return cut.length <= 18 ? cut : `${cut.slice(0, 17)}…`;
}

export function slugId(title: string, start: string | null, city: string): string {
  const base = `${title}|${start ?? ""}|${city}`.toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < base.length; i += 1) {
    hash ^= base.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/20\d{2}/g, "")
    .replace(/黑客松|黑客马拉松|hackathons?|hack\s*week/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function toEvent(draft: EventDraft, titleZh: string): EventItem {
  const ages = inferAges(draft);
  const sectors = inferSectors(draft, ages);
  const country = countryName(draft.country);
  return {
    id: slugId(draft.title, draft.start, draft.city),
    title: draft.title.trim(),
    titleZh,
    kind: inferKind(draft, sectors),
    region: inferRegion({ ...draft, country }),
    format: draft.format,
    ages,
    sectors,
    city: shortPlace(draft.city),
    country: country || "未注明",
    organizer: draft.organizer.trim(),
    start: draft.start,
    end: draft.end,
    deadline: draft.deadline,
    deadlineKind: draft.deadlineKind,
    prize: draft.prize.trim(),
    summary: draft.summary.trim(),
    url: draft.url,
    registrationUrl: draft.registrationUrl || draft.url,
    sources: [draft.source],
  };
}
