import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { formatDay } from "@/lib/dates";
import { ageText, displayTitle, placeLine, readableText, registrationLine } from "@/lib/present";
import { readEvent } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = readEvent(id);
  if (!event) notFound();
  const prize = event.prize.replace(/[；;]\s*[\u4e00-\u9fff]{1,2}$/u, "") || "未注明";
  const when = [formatDay(event.start), formatDay(event.end)].filter((item) => item !== "日期待定");
  const span = when.length === 2 && when[0] !== when[1] ? `${when[0]} – ${when[1]}` : when[0] || "日期待定";
  return (
    <article className="detail">
      <BackLink />
      <h1>{displayTitle(event.title)}</h1>
      {event.titleZh ? <p className="zh">{displayTitle(event.titleZh)}</p> : null}
      <dl className="facts">
        <div>
          <dt>形式</dt>
          <dd>{placeLine(event)}</dd>
        </div>
        <div>
          <dt>报名</dt>
          <dd>{registrationLine(event)}</dd>
        </div>
        <div>
          <dt>举办</dt>
          <dd>{span}</dd>
        </div>
        <div>
          <dt>年龄</dt>
          <dd>{ageText(event.ages)}</dd>
        </div>
        <div>
          <dt>类型</dt>
          <dd>
            {event.kind}
            {event.sectors.length ? ` · ${event.sectors.join(" · ")}` : ""}
          </dd>
        </div>
        <div>
          <dt>主办</dt>
          <dd>{event.organizer || "未注明"}</dd>
        </div>
        <div className="span">
          <dt>奖金</dt>
          <dd>{prize}</dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>{event.sources.join(" · ")}</dd>
        </div>
      </dl>
      <a className="apply" href={event.registrationUrl || event.url} target="_blank" rel="noreferrer">
        打开报名页
      </a>
      {event.summary ? <div className="summary">{readableText(event.summary)}</div> : null}
    </article>
  );
}
