import { acceptVisit, appendVisit } from "@/lib/analytics";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const row = acceptVisit(body);
  if (!row) return Response.json({ ok: false }, { status: 400 });
  appendVisit(row);
  return Response.json({ ok: true });
}
