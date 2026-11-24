export type CsvCell = string | number | boolean | null | undefined;

const FORMULA_TRIGGER = /^[\s]*[=+\-@\t\r]/;

/**
 * Quote and escape one CSV field. Values that could be interpreted as a
 * spreadsheet formula are prefixed with an apostrophe. Numbers and booleans
 * are emitted as plain values and are not treated as user-authored strings.
 */
export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const sanitized = FORMULA_TRIGGER.test(value) ? `'${value}` : value;
  const escaped = sanitized.replace(/"/g, '""');

  return /[",\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

/**
 * UTF-8 CSV with a byte-order mark for spreadsheet compatibility and CRLF
 * record separators. The caller remains responsible for authorization and for
 * choosing the correct filename.
 */
export function serializeCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function csvDownloadHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
  };
}

export function icsDownloadHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
    "Cache-Control": "private, no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    Vary: "Cookie",
  };
}
