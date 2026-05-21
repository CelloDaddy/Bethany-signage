import { NextRequest, NextResponse } from "next/server";
import { buildPlaylist } from "@/lib/playlist";

export const revalidate = 60; // cache for 60s

export async function GET(req: NextRequest) {
  const screenId = req.nextUrl.searchParams.get("screen") || "lobby";
  try {
    const slides = await buildPlaylist(screenId);
    return NextResponse.json({ slides }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
