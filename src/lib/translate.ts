import { hasChinese } from "./classify";
import { fetchJson } from "./http";
import { readTranslations, writeTranslations } from "./store";

const PHRASES: Array<[RegExp, string]> = [
  [/artificial intelligence/gi, "人工智能"],
  [/machine learning/gi, "机器学习"],
  [/open source/gi, "开源"],
  [/hackathon/gi, "黑客松"],
  [/innovation challenge/gi, "创新挑战赛"],
  [/challenge/gi, "挑战赛"],
  [/developer/gi, "开发者"],
  [/students?/gi, "学生"],
  [/university/gi, "大学"],
  [/robotics?/gi, "机器人"],
  [/healthcare|medical/gi, "医疗"],
  [/security/gi, "安全"],
  [/hardware/gi, "硬件"],
  [/global/gi, "全球"],
  [/online/gi, "线上"],
];

function tidyZh(text: string): string {
  return text
    .replace(/\s+([，。、；：）)])/g, "$1")
    .replace(/([（(])\s+/g, "$1")
    .replace(/\$\s+/g, "$")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function glossaryZh(title: string): string {
  let text = title;
  for (const [pattern, word] of PHRASES) text = text.replace(pattern, word);
  if (hasChinese(text)) return tidyZh(text);
  if (/hack/i.test(title)) return `${title} 黑客松`;
  if (/challenge|sprint|cup|competition/i.test(title)) return `${title} 挑战赛`;
  return `${title} 比赛`;
}

async function memoryTranslate(title: string): Promise<string | null> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(title.slice(0, 400))}&langpair=en|zh-CN`;
  const data = await fetchJson<{
    responseData?: { translatedText?: string };
    responseStatus?: number;
    responseDetails?: string;
  }>(url, 12000);
  const text = data.responseData?.translatedText?.trim() ?? "";
  if (!text || !hasChinese(text) || text.toLowerCase() === title.toLowerCase()) return null;
  if (/MYMEMORY WARNING|QUERY LENGTH/i.test(text) || /MYMEMORY WARNING/i.test(data.responseDetails ?? "")) {
    throw new Error("translate-quota");
  }
  return text;
}

export async function translateTitles(
  titles: string[],
  onProgress: (message: string) => void,
): Promise<Map<string, string>> {
  const cache = readTranslations();
  for (const [title, value] of Object.entries(cache)) {
    if (value.includes("暂无")) cache[title] = glossaryZh(title);
  }
  const pending = [...new Set(titles.filter((title) => title && !hasChinese(title) && !cache[title]))];
  let quotaHit = false;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
    while (cursor < pending.length) {
      const index = cursor;
      cursor += 1;
      const title = pending[index];
      onProgress(`正在翻译名称 ${index + 1}/${pending.length}`);
      if (quotaHit) {
        cache[title] = glossaryZh(title);
        continue;
      }
      try {
        cache[title] = tidyZh((await memoryTranslate(title)) ?? glossaryZh(title));
      } catch {
        quotaHit = true;
        cache[title] = glossaryZh(title);
      }
    }
  });
  await Promise.all(workers);
  if (pending.length) writeTranslations(cache);
  return new Map(Object.entries(cache));
}
