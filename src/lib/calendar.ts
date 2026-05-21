// Common first names for detection — extended list
const FIRST_NAMES = new Set([
  "james","john","robert","michael","william","david","richard","joseph","thomas","charles",
  "christopher","daniel","matthew","anthony","mark","donald","steven","paul","andrew","joshua",
  "kenneth","kevin","brian","george","timothy","ronald","edward","jason","jeffrey","ryan",
  "jacob","gary","nicholas","eric","jonathan","stephen","larry","justin","scott","brandon",
  "benjamin","samuel","raymond","gregory","frank","alexander","patrick","jack","dennis","jerry",
  "mary","patricia","jennifer","linda","barbara","elizabeth","susan","jessica","sarah","karen",
  "lisa","nancy","betty","margaret","sandra","ashley","dorothy","kimberly","emily","donna",
  "michelle","carol","amanda","melissa","deborah","stephanie","rebecca","sharon","laura","cynthia",
  "kathleen","amy","angela","shirley","anna","brenda","pamela","emma","nicole","helen","samantha",
  "katherine","christine","debra","rachel","carolyn","janet","catherine","maria","heather","diane",
  "ruth","julie","olivia","joyce","virginia","victoria","kelly","lauren","joan","evelyn",
  "ritch","josh","beakley","kyler","boerckel","sheaffer","tyler","dave","sarah","art",
]);

export interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string };
  location?: string;
  visibility?: string;
}

export interface FilteredEvent {
  id: string;
  name: string;
  startTime: string;
  location: string;
}

function hasPersonName(title: string): boolean {
  // Exception: Community Group always passes
  if (/community\s+group/i.test(title)) return false;

  // "with Pastor [Name]" or "Pastor [Name]" (name follows Pastor) → hide
  if (/\bwith\s+pastor\b/i.test(title)) return true;
  if (/\bpastor\s+[a-z]/i.test(title)) return true;

  const words = title.toLowerCase().split(/[\s,''\-&\/()]+/);
  for (const word of words) {
    if (word.length > 1 && FIRST_NAMES.has(word)) return true;
  }
  return false;
}

function isAllDay(event: CalendarEvent): boolean {
  return !event.start.dateTime && !!event.start.date;
}

function formatTime(dateTimeStr: string, timeZone: string): string {
  const d = new Date(dateTimeStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timeZone || "America/Chicago",
  }).replace(":00", "").toLowerCase();
}

export function filterEvents(
  events: CalendarEvent[],
  options: {
    hideAllDay: boolean;
    maxEvents: number;
    now?: Date;
    timeZone?: string;
  }
): FilteredEvent[] {
  const now = options.now || new Date();
  const tz = options.timeZone || "America/Chicago";

  return events
    .filter((e) => {
      if (e.visibility === "private") return false;
      if (options.hideAllDay && isAllDay(e)) return false;
      if (hasPersonName(e.summary)) return false;
      // Hide past events (events that have already ended)
      const endStr = e.end.dateTime || e.end.date;
      if (endStr) {
        const endTime = new Date(endStr);
        if (endTime < now) return false;
      }
      return true;
    })
    .slice(0, options.maxEvents)
    .map((e) => ({
      id: e.id,
      name: e.summary,
      startTime: e.start.dateTime ? formatTime(e.start.dateTime, tz) : "all day",
      location: e.location || "",
    }));
}
