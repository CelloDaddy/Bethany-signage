import { getDb } from "./db";
import { filterEvents, CalendarEvent } from "./calendar";
import { getActiveVerses } from "./verses";

export type SlideType = "image" | "video" | "events" | "verse";

export interface Slide {
  id: string;
  type: SlideType;
  name: string;
  durationSeconds: number;
  // image/video
  blobUrl?: string;
  mimeType?: string;
  // events
  events?: { id: string; name: string; startTime: string; location: string }[];
  eventsDate?: string;
  // verse
  verseRef?: string;
  verseText?: string;
}

function todayDow(): number {
  return new Date().getDay(); // 0=Sun
}

function isScheduledToday(
  startDate: string | null,
  endDate: string | null,
  daysOfWeek: string
): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (startDate) {
    const s = new Date(startDate);
    s.setHours(0, 0, 0, 0);
    if (today < s) return false;
  }
  if (endDate) {
    const e = new Date(endDate);
    e.setHours(0, 0, 0, 0);
    if (today > e) return false;
  }
  const days = daysOfWeek.split(",").map(Number);
  return days.includes(todayDow());
}

function priorityWeight(priority: string): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function buildLoop(items: Array<{ slide: Slide | Slide[]; weight: number }>): Slide[] {
  // Expand items by weight into slots, interleave
  const result: Slide[] = [];
  const maxWeight = Math.max(...items.map((i) => i.weight), 1);
  for (let w = maxWeight; w >= 1; w--) {
    for (const item of items) {
      if (item.weight >= w) {
        if (Array.isArray(item.slide)) {
          result.push(...item.slide);
        } else {
          result.push(item.slide);
        }
      }
    }
  }
  return result;
}

export async function buildPlaylist(screenId: string): Promise<Slide[]> {
  const sql = getDb();

  // Get config
  const configRows = await sql`SELECT key, value FROM config`;
  const config: Record<string, string> = {};
  for (const row of configRows) config[row.key] = row.value;

  // Get all media for this screen that is scheduled today (ungrouped)
  const mediaRows = await sql`
    SELECT m.*, ms.screen_id
    FROM media_items m
    JOIN media_screens ms ON ms.media_id = m.id
    WHERE ms.screen_id = ${screenId}
      AND m.group_id IS NULL
      AND m.type != 'dynamic'
    ORDER BY m.created_at
  `;

  // Get groups for this screen
  const groupRows = await sql`
    SELECT g.*, gs.screen_id
    FROM groups g
    JOIN group_screens gs ON gs.group_id = g.id
    WHERE gs.screen_id = ${screenId}
    ORDER BY g.created_at
  `;

  // Get group media
  const groupMediaRows = await sql`
    SELECT m.*
    FROM media_items m
    WHERE m.group_id IS NOT NULL
    ORDER BY m.group_id, m.group_order
  `;

  const items: Array<{ slide: Slide | Slide[]; weight: number }> = [];

  // Individual media slides
  for (const row of mediaRows) {
    if (!isScheduledToday(row.start_date, row.end_date, row.days_of_week)) continue;
    const slide: Slide = {
      id: row.id,
      type: row.type as SlideType,
      name: row.name,
      durationSeconds: row.duration_seconds,
      blobUrl: row.blob_url,
      mimeType: row.mime_type,
    };
    items.push({ slide, weight: priorityWeight(row.priority) });
  }

  // Group slides
  for (const group of groupRows) {
    if (!isScheduledToday(group.start_date, group.end_date, group.days_of_week)) continue;
    const members = groupMediaRows
      .filter((m: { group_id: string }) => m.group_id === group.id)
      .map((m: { id: string; type: string; name: string; duration_seconds: number; blob_url: string; mime_type: string }) => ({
        id: m.id,
        type: m.type as SlideType,
        name: m.name,
        durationSeconds: m.duration_seconds,
        blobUrl: m.blob_url,
        mimeType: m.mime_type,
      }));
    if (members.length > 0) {
      items.push({ slide: members, weight: priorityWeight(group.priority) });
    }
  }

  // Dynamic: events slide
  if (config["calendar.enabled"] === "true") {
    const calId = config["calendar.calendarId"];
    let events: ReturnType<typeof filterEvents> = [];
    try {
      const icalUrl = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calId)}/public/basic.ics`;
      const res = await fetch(icalUrl, { next: { revalidate: 3600 } });
      if (res.ok) {
        const text = await res.text();
        events = filterEvents(parseIcal(text), {
          hideAllDay: config["calendar.hideAllDay"] === "true",
          maxEvents: parseInt(config["calendar.maxEvents"] || "6"),
        });
        // Fallback to tomorrow if quiet
        if (events.length < 2 && config["calendar.fallbackTomorrow"] === "true") {
          const tomorrow = filterEvents(parseIcal(text), {
            hideAllDay: config["calendar.hideAllDay"] === "true",
            maxEvents: parseInt(config["calendar.maxEvents"] || "6"),
            now: new Date(Date.now() + 86400000),
          });
          if (tomorrow.length > 0) events = tomorrow;
        }
      }
    } catch {}

    if (events.length > 0) {
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
        timeZone: "America/Chicago",
      });
      const eventsSlide: Slide = {
        id: "dynamic-events",
        type: "events",
        name: "Today's Events",
        durationSeconds: 20,
        events,
        eventsDate: today,
      };
      items.push({ slide: eventsSlide, weight: 2 });
    }
  }

  // Dynamic: verse slides
  if (config["verse.enabled"] === "true") {
    const pool = JSON.parse(config["verse.pool"] || "[]");
    const activeCount = parseInt(config["verse.activeCount"] || "3");
    const verses = getActiveVerses(pool, activeCount);
    for (const v of verses) {
      const slide: Slide = {
        id: `verse-${v.ref}`,
        type: "verse",
        name: v.ref,
        durationSeconds: 15,
        verseRef: v.ref,
        verseText: v.text,
      };
      items.push({ slide, weight: 2 });
    }
  }

  return buildLoop(items);
}

// Minimal iCal parser
function parseIcal(text: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = text.replace(/\r\n\s/g, "").replace(/\r\n/g, "\n").split("\n");
  let current: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
    } else if (line === "END:VEVENT" && current) {
      if (current.summary && current.start) {
        events.push(current as CalendarEvent);
      }
      current = null;
    } else if (current) {
      if (line.startsWith("SUMMARY:")) {
        current.summary = line.slice(8).trim();
      } else if (line.startsWith("DTSTART;TZID=")) {
        const tz = line.match(/TZID=([^:]+)/)?.[1] || "America/Chicago";
        const val = line.split(":")[1];
        current.start = { dateTime: parseIcalDate(val), timeZone: tz };
      } else if (line.startsWith("DTSTART:")) {
        const val = line.slice(8);
        if (val.length === 8) {
          current.start = { date: `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}` };
        } else {
          current.start = { dateTime: parseIcalDate(val) };
        }
      } else if (line.startsWith("DTEND;TZID=")) {
        const val = line.split(":")[1];
        current.end = { dateTime: parseIcalDate(val) };
      } else if (line.startsWith("DTEND:")) {
        const val = line.slice(6);
        current.end = { dateTime: parseIcalDate(val) };
      } else if (line.startsWith("LOCATION:")) {
        current.location = line.slice(9).trim();
      } else if (line.startsWith("CLASS:")) {
        current.visibility = line.slice(6).trim().toLowerCase();
      }
    }
  }
  return events;
}

function parseIcalDate(s: string): string {
  // 20260521T190000 or 20260521T190000Z
  const clean = s.replace("Z", "");
  return `${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T${clean.slice(9,11)}:${clean.slice(11,13)}:${clean.slice(13,15)}`;
}
