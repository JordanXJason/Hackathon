import fs from "fs";
import path from "path";
import type { CacheFile } from "./types";

const dataDir = path.join(process.cwd(), "data");
const cachePath = path.join(dataDir, "events.json");
const translationPath = path.join(dataDir, "translations.json");

function ensure() {
  fs.mkdirSync(dataDir, { recursive: true });
}

export function readCache(): CacheFile {
  try {
    const raw = fs.readFileSync(cachePath, "utf8");
    const parsed = JSON.parse(raw) as CacheFile;
    return {
      updatedAt: parsed.updatedAt ?? null,
      events: parsed.events ?? [],
      report: parsed.report ?? [],
    };
  } catch {
    return { updatedAt: null, events: [], report: [] };
  }
}

export function writeCache(cache: CacheFile) {
  ensure();
  fs.writeFileSync(cachePath, JSON.stringify(cache));
}

export function readTranslations(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(translationPath, "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export function writeTranslations(map: Record<string, string>) {
  ensure();
  fs.writeFileSync(translationPath, JSON.stringify(map, null, 2));
}

export function readEvent(id: string) {
  return readCache().events.find((event) => event.id === id) ?? null;
}
