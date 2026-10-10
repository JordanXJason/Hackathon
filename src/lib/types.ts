export type AgeGroup = "小学" | "初中" | "高中" | "大学" | "成年人" | "未标明";
export type EventFormat = "online" | "offline" | "hybrid";
export type Region = "china" | "international";
export type EventKind =
  | "黑客松"
  | "AI创新大赛"
  | "机器人赛"
  | "线上数据赛"
  | "青少年学科竞赛";
export type DeadlineKind = "registration" | "submission" | "unknown";

export interface EventDraft {
  title: string;
  start: string | null;
  end: string | null;
  deadline: string | null;
  deadlineKind: DeadlineKind;
  format: EventFormat;
  city: string;
  country: string;
  organizer: string;
  prize: string;
  summary: string;
  url: string;
  registrationUrl: string;
  hint: string;
  source: string;
}

export interface EventItem {
  id: string;
  title: string;
  titleZh: string;
  kind: EventKind;
  region: Region;
  format: EventFormat;
  ages: AgeGroup[];
  sectors: string[];
  city: string;
  country: string;
  organizer: string;
  start: string | null;
  end: string | null;
  deadline: string | null;
  deadlineKind: DeadlineKind;
  prize: string;
  summary: string;
  url: string;
  registrationUrl: string;
  sources: string[];
}

export interface SourceReport {
  source: string;
  fetched: number;
  upstream: number | null;
  kept: number;
  error?: string;
}

export interface CacheFile {
  updatedAt: string | null;
  events: EventItem[];
  report: SourceReport[];
}

export const SECTORS = [
  "AI",
  "硬件",
  "机器人",
  "医疗",
  "Web3",
  "开源",
  "安全",
  "游戏",
  "学生",
  "大厂",
] as const;

export const AGE_GROUPS: AgeGroup[] = ["小学", "初中", "高中", "大学", "成年人", "未标明"];

export const FORMATS: EventFormat[] = ["online", "offline", "hybrid"];
