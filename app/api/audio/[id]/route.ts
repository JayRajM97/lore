import { NextRequest } from "next/server";

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:8000";

// GET /api/audio/{id} -> proxy sidecar /audio/{id}, forwarding Range so the
// <audio> element can scrub/seek. Streams MP3 back with range headers intact.
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const range = req.headers.get("range");
  const upstream = await fetch(`${SIDECAR_URL}/audio/${params.id}`, {
    headers: range ? { Range: range } : {},
  });

  const headers = new Headers();
  headers.set("Content-Type", "audio/mpeg");
  headers.set("Accept-Ranges", "bytes");
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function HEAD() {
  return new Response(null, { status: 200 });
}
