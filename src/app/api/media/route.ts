import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { put, del } from "@vercel/blob";

function auth(req: NextRequest) {
  const pw = req.headers.get("x-admin-password");
  return pw === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  const sql = getDb();
  const items = await sql`
    SELECT m.*, 
      array_agg(ms.screen_id) FILTER (WHERE ms.screen_id IS NOT NULL) AS screens
    FROM media_items m
    LEFT JOIN media_screens ms ON ms.media_id = m.id
    GROUP BY m.id
    ORDER BY m.created_at DESC
  `;
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const meta = JSON.parse(formData.get("meta") as string || "{}");

  const sql = getDb();
  const id = crypto.randomUUID();

  let blobUrl: string | null = null;
  let mimeType: string | null = null;
  let fileSize: number | null = null;

  if (file) {
    mimeType = file.type;
    fileSize = file.size;
const blob = await put(`media/${id}/${file.name}`, file, { access: "private" });
    blobUrl = blob.url;
  }

  await sql`
    INSERT INTO media_items (
      id, name, type, dynamic_type, blob_url, mime_type, file_size,
      duration_seconds, priority, start_date, end_date, days_of_week,
      group_id, group_order
    ) VALUES (
      ${id}, ${meta.name}, ${meta.type}, ${meta.dynamicType || null},
      ${blobUrl}, ${mimeType}, ${fileSize},
      ${meta.durationSeconds || 10}, ${meta.priority || "medium"},
      ${meta.startDate || null}, ${meta.endDate || null},
      ${meta.daysOfWeek || "0,1,2,3,4,5,6"},
      ${meta.groupId || null}, ${meta.groupOrder || null}
    )
  `;

  if (meta.screens?.length) {
    for (const screenId of meta.screens) {
      await sql`INSERT INTO media_screens (media_id, screen_id) VALUES (${id}, ${screenId}) ON CONFLICT DO NOTHING`;
    }
  }

  return NextResponse.json({ id });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  const sql = getDb();
  const [item] = await sql`SELECT blob_url FROM media_items WHERE id = ${id}`;
  if (item?.blob_url) {
    try { await del(item.blob_url); } catch {}
  }
  await sql`DELETE FROM media_items WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, ...updates } = await req.json();
  const sql = getDb();
  if (updates.durationSeconds !== undefined)
    await sql`UPDATE media_items SET duration_seconds = ${updates.durationSeconds} WHERE id = ${id}`;
  if (updates.priority !== undefined)
    await sql`UPDATE media_items SET priority = ${updates.priority} WHERE id = ${id}`;
  if (updates.startDate !== undefined)
    await sql`UPDATE media_items SET start_date = ${updates.startDate} WHERE id = ${id}`;
  if (updates.endDate !== undefined)
    await sql`UPDATE media_items SET end_date = ${updates.endDate} WHERE id = ${id}`;
  if (updates.daysOfWeek !== undefined)
    await sql`UPDATE media_items SET days_of_week = ${updates.daysOfWeek} WHERE id = ${id}`;
  if (updates.screens !== undefined) {
    await sql`DELETE FROM media_screens WHERE media_id = ${id}`;
    for (const screenId of updates.screens) {
      await sql`INSERT INTO media_screens (media_id, screen_id) VALUES (${id}, ${screenId}) ON CONFLICT DO NOTHING`;
    }
  }
  return NextResponse.json({ ok: true });
}
