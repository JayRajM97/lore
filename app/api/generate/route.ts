import { NextRequest, NextResponse } from "next/server";

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:8000";

// POST /api/generate -> proxy to sidecar /synthesize, rewrite audio_url to
// our same-origin /api/audio/{id} so the browser has no CORS/mixed-content issue.
export async function POST(req: NextRequest) {
  let body: { text?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const res = await fetch(`${SIDECAR_URL}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json(
        { error: "Sidecar error", detail },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({
      ...data,
      audio_url: `/api/audio/${data.id}`,
    });
  } catch {
    return NextResponse.json(
      { error: "TTS server not reachable" },
      { status: 502 }
    );
  }
}
