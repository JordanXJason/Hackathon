import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "黑客松大赛赛历",
  description: "未来一年的黑客松和 AI 比赛，按时间、地区、年龄和线上线下查看。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
