export function formatDate(value: Date, timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeZone,
  }).format(value);
}

export function formatTime(value: Date, timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en", {
    timeStyle: "short",
    timeZone,
  }).format(value);
}

export function formatDateTime(value: Date, timeZone = "Asia/Kolkata"): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(value);
}

export function formatDateRange(startsAt: Date, endsAt: Date, timeZone = "Asia/Kolkata"): string {
  const startDate = formatDate(startsAt, timeZone);
  const endDate = formatDate(endsAt, timeZone);

  if (startDate === endDate) {
    return `${startDate}, ${formatTime(startsAt, timeZone)} to ${formatTime(endsAt, timeZone)}`;
  }

  return `${startDate} ${formatTime(startsAt, timeZone)} to ${endDate} ${formatTime(endsAt, timeZone)}`;
}

export function formatMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);

  if (!year || !month || month < 1 || month > 12) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function toDateTimeInputValue(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }

  return value.toISOString().slice(0, 16);
}

export function formatRelativeDate(value: Date, now = new Date()): string {
  const diff = value.getTime() - now.getTime();
  const day = 24 * 60 * 60 * 1000;
  const days = Math.round(diff / day);

  if (Math.abs(days) < 1) {
    return "Today";
  }

  if (days === 1) {
    return "Tomorrow";
  }

  if (days === -1) {
    return "Yesterday";
  }

  if (days > 1 && days <= 7) {
    return `In ${days} days`;
  }

  if (days < -1 && days >= -7) {
    return `${Math.abs(days)} days ago`;
  }

  return formatDate(value);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}
