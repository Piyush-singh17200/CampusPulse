import { createHash } from "node:crypto";

export type IcsEvent = {
  id: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  venueName?: string | null;
  venueAddress?: string | null;
  isOnline?: boolean;
  onlineUrl?: string | null;
  organizerName: string;
  eventUrl?: string | null;
  categories?: string[];
  status?: "CONFIRMED" | "CANCELLED";
  updatedAt?: Date | null;
};

export type IcsCalendarOptions = {
  calendarName: string;
  timezone: string;
  now?: Date;
  method?: "PUBLISH" | "CANCEL";
};

const CRLF = "\r\n";
const encoder = new TextEncoder();

/**
 * RFC 5545 text escaping. Backslashes must be escaped first so the newline
 * escape introduced below is not escaped twice.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Fold a content line at 75 UTF-8 octets. Continuation lines begin with one
 * space, which counts toward their octet budget.
 */
export function foldIcsLine(line: string): string {
  if (!line) {
    return "";
  }

  const pieces: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const character of line) {
    const bytes = encoder.encode(character).length;

    if (currentBytes + bytes > 75) {
      pieces.push(current);
      current = ` ${character}`;
      currentBytes = 1 + bytes;
    } else {
      current += character;
      currentBytes += bytes;
    }
  }

  pieces.push(current);
  return pieces.join(CRLF);
}

export function formatIcsUtc(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/**
 * A deterministic, opaque UID. It is stable for the lifetime of an event but
 * does not expose the internal database identifier.
 */
export function icsEventUid(eventId: string): string {
  return `${createHash("sha256").update(`campuspulse-event:${eventId}`).digest("hex").slice(0, 32)}@campuspulse`;
}

function property(name: string, value: string): string {
  return `${name}:${value}`;
}

function eventLines(event: IcsEvent, now: Date): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(property("UID", icsEventUid(event.id)));
  lines.push(property("DTSTAMP", formatIcsUtc(now)));
  lines.push(property("DTSTART", formatIcsUtc(event.startsAt)));
  lines.push(property("DTEND", formatIcsUtc(event.endsAt)));
  lines.push(property("SUMMARY", escapeIcsText(event.title)));

  const descriptionParts = [event.summary, event.description].filter((part): part is string =>
    Boolean(part?.trim()),
  );
  if (event.onlineUrl) {
    descriptionParts.push(`Join link: ${event.onlineUrl}`);
  }
  if (event.eventUrl) {
    descriptionParts.push(`Event page: ${event.eventUrl}`);
  }
  if (descriptionParts.length) {
    lines.push(property("DESCRIPTION", escapeIcsText(descriptionParts.join("\n\n"))));
  }

  const location = event.isOnline
    ? "Online"
    : [event.venueName, event.venueAddress].filter(Boolean).join(", ");
  if (location) {
    lines.push(property("LOCATION", escapeIcsText(location)));
  }

  lines.push(
    property(
      "ORGANIZER;CN=" + escapeIcsText(event.organizerName),
      "mailto:no-reply@campuspulse.local",
    ),
  );

  if (event.eventUrl) {
    lines.push(property("URL", event.eventUrl));
  }

  if (event.categories?.length) {
    lines.push(property("CATEGORIES", event.categories.map(escapeIcsText).join(",")));
  }

  lines.push(property("STATUS", event.status ?? "CONFIRMED"));
  lines.push("TRANSP:OPAQUE");

  const sequence = event.updatedAt ? Math.max(0, Math.floor(event.updatedAt.getTime() / 1000)) : 0;
  lines.push(property("SEQUENCE", String(sequence)));
  lines.push("END:VEVENT");

  return lines;
}

export function buildIcsCalendar(events: IcsEvent[], options: IcsCalendarOptions): string {
  const now = options.now ?? new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusPulse//Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${options.method ?? "PUBLISH"}`,
    property("X-WR-CALNAME", escapeIcsText(options.calendarName)),
    property("X-WR-TIMEZONE", options.timezone),
  ];

  for (const event of events) {
    lines.push(...eventLines(event, now));
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(foldIcsLine).join(CRLF)}${CRLF}`;
}
