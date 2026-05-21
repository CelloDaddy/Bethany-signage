import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

function auth(req: NextRequest) {
  return req.headers.get("x-admin-password") === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  const sql = getDb();
  const groups = await sql`
    SELECT g.*,
      array_agg(DISTINCT gs.screen_id) FILTER (WHERE gs.screen_id IS NOT NULL) AS screens,
      json_agg(m.* ORDER BY m.group_order) FILTER (WHERE m.id IS NOT NULL) AS members
    FROM groups g
    LEFT JOIN group_screens gs ON gs.group_id = g.id
    LEFT JOIN media_items m ON m.group_id = g.id
    GROUP BY g.id
    ORDER BY g.created_at
  `;
  const screens = await sql`SELECT * FROM screens ORDER BY name`;
  return NextResponse.json({ groups, screens });
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const sql = getDb();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO groups (id, name, priority, start_date, end_date, days_of_week)
    VALUES (${id}, ${body.name}, ${body.priority || "medium"},
            ${body.startDate || null}, ${body.endDate || null},
            ${body.daysOfWeek || "0,1,2,3,4,5,6"})
  `;
  if (body.screens?.length) {
    for (const screenId of body.screens) {
      await sql`INSERT INTO group_screens (group_id, screen_id) VALUES (${id}, ${screenId}) ON CONFLICT DO NOTHING`;
    }
  }
  return NextResponse.json({ id });
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, ...updates } = await req.json();
  const sql = getDb();
  if (updates.name) await sql`UPDATE groups SET name = ${updates.name} WHERE id = ${id}`;
  if (updates.priority) await sql`UPDATE groups SET priority = ${updates.priority} WHERE id = ${id}`;
  if (updates.startDate !== undefined) await sql`UPDATE groups SET start_date = ${updates.startDate} WHERE id = ${id}`;
  if (updates.endDate !== undefined) await sql`UPDATE groups SET end_date = ${updates.endDate} WHERE id = ${id}`;
  if (updates.daysOfWeek) await sql`UPDATE groups SET days_of_week = ${updates.daysOfWeek} WHERE id = ${id}`;
  if (updates.screens) {
    await sql`DELETE FROM group_screens WHERE group_id = ${id}`;
    for (const screenId of updates.screens) {
      await sql`INSERT INTO group_screens (group_id, screen_id) VALUES (${id}, ${screenId}) ON CONFLICT DO NOTHING`;
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  const sql = getDb();
  await sql`DELETE FROM groups WHERE id = ${id}`;
  return NextResponse.json({ ok: true });
}
