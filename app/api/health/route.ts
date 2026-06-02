import { NextResponse } from "next/server";

const SIDECAR_URL = process.env.SIDECAR_URL || "http://localhost:8000";

// GET /api/health -> sidecar /health. Used by the player to show the
// "TTS server not reachable" error state.
export async function GET() {
  try {
    const res = await fetch(`${SIDECAR_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error("bad status");
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ status: "down" }, { status: 502 });
  }
}
