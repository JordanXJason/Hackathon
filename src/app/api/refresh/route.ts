import { refreshAll } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

let running = false;

export async function POST() {
  if (running) {
    return Response.json({ error: "已有一次更新在进行" }, { status: 409 });
  }
  running = true;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      try {
        send({ message: "正在全网搜索" });
        const cache = await refreshAll((message) => send({ message }));
        send({ message: "更新完成", cache });
      } catch (error) {
        send({ error: error instanceof Error ? error.message : "更新失败" });
      } finally {
        running = false;
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
