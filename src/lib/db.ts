import { neon } from "@neondatabase/serverless";

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  return neon(process.env.DATABASE_URL);
}

// Run this once to initialize tables (called from /api/setup)
export async function initDb() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS screens (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      default_duration INTEGER NOT NULL DEFAULT 10,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium',
      start_date DATE,
      end_date DATE,
      days_of_week TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS group_screens (
      group_id TEXT REFERENCES groups(id) ON DELETE CASCADE,
      screen_id TEXT REFERENCES screens(id) ON DELETE CASCADE,
      PRIMARY KEY (group_id, screen_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('image','video','dynamic')),
      dynamic_type TEXT CHECK (dynamic_type IN ('events','verse')),
      blob_url TEXT,
      mime_type TEXT,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      duration_seconds INTEGER NOT NULL DEFAULT 10,
      priority TEXT NOT NULL DEFAULT 'medium',
      start_date DATE,
      end_date DATE,
      days_of_week TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
      group_id TEXT REFERENCES groups(id) ON DELETE SET NULL,
      group_order INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS media_screens (
      media_id TEXT REFERENCES media_items(id) ON DELETE CASCADE,
      screen_id TEXT REFERENCES screens(id) ON DELETE CASCADE,
      PRIMARY KEY (media_id, screen_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Seed default screens if not present
  await sql`
    INSERT INTO screens (id, name, default_duration) VALUES
      ('lobby', 'Lobby Slides', 10),
      ('reception', 'Reception Slides', 10)
    ON CONFLICT (id) DO NOTHING
  `;

  // Seed default config
  const defaults: Record<string, string> = {
    "calendar.enabled": "true",
    "calendar.calendarId": "bethanycentral.org_2pchr3sqtv3nv807r527sjou0k@group.calendar.google.com",
    "calendar.refreshMinutes": "60",
    "calendar.maxEvents": "6",
    "calendar.showLocation": "true",
    "calendar.hideAllDay": "true",
    "calendar.fallbackTomorrow": "true",
    "verse.enabled": "true",
    "verse.translation": "ESV",
    "verse.changeFrequency": "daily",
    "verse.activeCount": "3",
    "verse.seriesUrl": "https://bethanycentral.org/sermons",
    "verse.pool": JSON.stringify([
      { ref: "Galatians 2:20", active: true },
      { ref: "Galatians 3:26-27", active: true },
      { ref: "Galatians 4:4-5", active: true },
      { ref: "Galatians 5:1", active: true },
      { ref: "Galatians 5:22-23", active: true },
      { ref: "Romans 8:15-16", active: true },
      { ref: "Romans 5:1", active: true },
      { ref: "Ephesians 1:7", active: true },
      { ref: "2 Corinthians 5:17", active: true },
      { ref: "John 8:36", active: true },
      { ref: "Galatians 6:14", active: false },
      { ref: "Romans 8:1", active: false },
    ]),
  };
  for (const [key, value] of Object.entries(defaults)) {
    await sql`
      INSERT INTO config (key, value) VALUES (${key}, ${value})
      ON CONFLICT (key) DO NOTHING
    `;
  }
  return { ok: true };
}
