import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function auth(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  const sql = getDb();
  const rows = await sql`SELECT key, value FROM config`;
  const config: Record<string, string> = {};
  for (const row of rows) config[row.key] = row.value;
  return NextResponse.json({ config });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { updates } = await req.json() as { updates: Record<string, string> };
  const sql = getDb();
  for (const [key, value] of Object.entries(updates)) {
    await sql`
      INSERT INTO config (key, value, updated_at) VALUES (${key}, ${value}, NOW())
      ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
    `;
  }
  return NextResponse.json({ ok: true });
}
