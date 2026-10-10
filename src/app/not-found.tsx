import { BackLink } from "@/components/BackLink";

export default function NotFound() {
  return (
    <article className="detail">
      <BackLink />
      <h1>没有这场比赛</h1>
      <p className="lede">这场比赛不在当前清单里。</p>
    </article>
  );
}
