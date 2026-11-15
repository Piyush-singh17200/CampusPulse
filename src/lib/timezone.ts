export type ZonedDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/**
 * Calendar parts for a timestamp in an IANA timezone. Event dates are stored as
 * absolute `timestamptz` values; this helper is only used when a user-facing
 * date/time string must be interpreted in the college's timezone.
 */
export function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  let hour = Number(parts.hour);
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
  };
}

function timezoneOffsetAt(date: Date, timeZone: string): number {
  const parts = getZonedDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return asUtc - date.getTime();
}

function parseDatePart(value: string): { year: number; month: number; day: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

function parseTimePart(value: string): { hour: number; minute: number } | null {
  const match = value.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

/**
 * Converts a wall-clock date and time in a college timezone to a UTC instant.
 * It performs a second offset pass so DST transitions do not silently shift the
 * result. Invalid date/time strings return null.
 */
export function zonedDateTimeToUtc(
  dateValue: string,
  timeValue: string,
  timeZone: string,
): Date | null {
  const date = parseDatePart(dateValue);
  const time = parseTimePart(timeValue);
  if (!date || !time) {
    return null;
  }

  const wallClock = new Date(Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute));
  const firstOffset = timezoneOffsetAt(wallClock, timeZone);
  let result = new Date(wallClock.getTime() - firstOffset);
  const secondOffset = timezoneOffsetAt(result, timeZone);

  if (secondOffset !== firstOffset) {
    result = new Date(wallClock.getTime() - secondOffset);
  }

  return result;
}

export function zonedDateString(date: Date, timeZone: string): string {
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function zonedTimeString(date: Date, timeZone: string): string {
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}
