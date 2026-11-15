import type { PosterOcrExtractionStatus, PosterOcrFieldName } from "@/generated/prisma/enums";

/**
 * Deterministic poster text extraction.
 *
 * This module deliberately does not import Tesseract or the database. It turns
 * recognized text plus optional word confidence into reviewable suggestions.
 * Dates and times are only returned when they are unambiguous; ambiguous values
 * keep `value: null` and explain what was seen so an organizer can decide.
 */

export type OcrWord = {
  text: string;
  confidence: number | null;
};

export type OcrCategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export type OcrSuggestion = {
  field: PosterOcrFieldName;
  value: string | null;
  confidence: number | null;
  evidence: string | null;
  extractionStatus: PosterOcrExtractionStatus;
  requiresReview: boolean;
};

export type OcrExtractionInput = {
  text: string;
  words?: OcrWord[];
  categories: OcrCategoryOption[];
  clubName?: string;
};

export type OcrExtractionResult = {
  text: string;
  suggestions: OcrSuggestion[];
};

const FIELD_ORDER: PosterOcrFieldName[] = [
  "TITLE",
  "SUMMARY",
  "DESCRIPTION",
  "START_DATE",
  "START_TIME",
  "END_DATE",
  "END_TIME",
  "REGISTRATION_DEADLINE_DATE",
  "REGISTRATION_DEADLINE_TIME",
  "VENUE",
  "VENUE_ADDRESS",
  "ORGANIZER",
  "CONTACT",
  "CATEGORY",
];

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const MONTH_PATTERN =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";

const DATE_LABEL = String.raw`date|when|day|schedule|held on`;
const DEADLINE_LABEL = String.raw`registration|register|deadline|last date|closes|closing date`;
const TIME_LABEL = String.raw`time|timing|starts|begins|ends`;
const VENUE_LABEL = String.raw`venue|location|where|place|address`;
const ORGANIZER_LABEL = String.raw`organi[sz]ed by|hosted by|organizer|host|club`;
const CONTACT_LABEL = String.raw`contact|email|phone|call|whatsapp|instagram|reach us`;

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  academic: [
    "academic",
    "workshop",
    "seminar",
    "lecture",
    "research",
    "paper",
    "quiz",
    "olympiad",
    "conference",
    "symposium",
  ],
  arts: [
    "art",
    "arts",
    "music",
    "dance",
    "drama",
    "film",
    "photography",
    "poetry",
    "culture",
    "cultural",
    "painting",
    "theatre",
    "theater",
  ],
  culture: ["culture", "cultural", "heritage", "festival", "fest"],
  sports: [
    "sports",
    "sport",
    "tournament",
    "match",
    "fitness",
    "yoga",
    "run",
    "marathon",
    "athletics",
    "football",
    "cricket",
    "basketball",
    "badminton",
  ],
  community: [
    "community",
    "volunteer",
    "volunteering",
    "social",
    "donation",
    "drive",
    "outreach",
    "service",
  ],
  career: [
    "career",
    "job",
    "internship",
    "placement",
    "entrepreneurship",
    "startup",
    "networking",
    "resume",
    "interview",
  ],
  technology: [
    "technology",
    "tech",
    "coding",
    "robotics",
    "robot",
    "artificial intelligence",
    " ai ",
    "machine learning",
    "hackathon",
    "programming",
    "software",
    "data science",
  ],
  environment: [
    "environment",
    "environmental",
    "climate",
    "sustainability",
    "sustainable",
    "green",
    "tree",
    "recycling",
  ],
  media: ["media", "journalism", "communication", "podcast", "radio", "film", "broadcast"],
};

type DateCandidate = {
  raw: string;
  index: number;
  lineIndex: number;
  value: string | null;
  status: PosterOcrExtractionStatus;
  reason: string;
};

type TimeValue = {
  value: string | null;
  status: PosterOcrExtractionStatus;
  reason: string;
};

type TimeRange = {
  start: TimeValue;
  end: TimeValue;
  evidence: string;
};

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeOcrText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean)
    .join("\n");
}

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function lineConfidence(line: string, words: OcrWord[]): number | null {
  if (!words.length) {
    return null;
  }

  const lineWords = normalizedWords(line);
  if (!lineWords.length) {
    return null;
  }

  const confidences = words
    .filter((word) => {
      const normalized = normalizedWords(word.text);
      return normalized.length > 0 && normalized.every((part) => lineWords.includes(part));
    })
    .map((word) => word.confidence)
    .filter((confidence): confidence is number => confidence !== null && confidence >= 0);

  if (!confidences.length) {
    return null;
  }

  const average = confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length;
  return Math.round(average * 10) / 10;
}

function suggestion(
  field: PosterOcrFieldName,
  input: {
    value?: string | null;
    confidence?: number | null;
    evidence?: string | null;
    extractionStatus: PosterOcrExtractionStatus;
  },
): OcrSuggestion {
  return {
    field,
    value: input.value ?? null,
    confidence: input.confidence ?? null,
    evidence: input.evidence ? input.evidence.slice(0, 2_000) : null,
    extractionStatus: input.extractionStatus,
    requiresReview: input.extractionStatus !== "MISSING",
  };
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function ymd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseNumericDate(
  first: string,
  second: string,
  yearValue: string,
  raw: string,
): Pick<DateCandidate, "value" | "status" | "reason"> {
  const year = Number(yearValue);
  if (yearValue.length === 2) {
    return {
      value: null,
      status: "AMBIGUOUS",
      reason: "The year has only two digits; use a four-digit year before applying.",
    };
  }

  const firstNumber = Number(first);
  const secondNumber = Number(second);

  if (firstNumber > 12 && secondNumber <= 12) {
    if (!isValidYmd(year, secondNumber, firstNumber)) {
      return { value: null, status: "INVALID", reason: "The date is not a valid calendar date." };
    }
    return {
      value: ymd(year, secondNumber, firstNumber),
      status: "EXTRACTED",
      reason: "Read as day/month/year.",
    };
  }

  if (firstNumber <= 12 && secondNumber <= 12) {
    return {
      value: null,
      status: "AMBIGUOUS",
      reason: `The numeric date "${raw}" could be day/month or month/day; confirm it manually.`,
    };
  }

  return {
    value: null,
    status: "AMBIGUOUS",
    reason: `The numeric date "${raw}" is not in an unambiguous day/month/year order.`,
  };
}

function collectDateCandidates(text: string): DateCandidate[] {
  const candidates: DateCandidate[] = [];
  const patterns: Array<{
    regex: RegExp;
    parse: (match: RegExpExecArray) => Pick<DateCandidate, "value" | "status" | "reason">;
  }> = [
    {
      regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g,
      parse: (match) => {
        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        if (!isValidYmd(year, month, day)) {
          return {
            value: null,
            status: "INVALID",
            reason: "The date is not a valid calendar date.",
          };
        }
        return {
          value: ymd(year, month, day),
          status: "EXTRACTED",
          reason: "Read as year/month/day.",
        };
      },
    },
    {
      regex: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/g,
      parse: (match) => parseNumericDate(match[1], match[2], match[3], match[0]),
    },
    {
      regex: /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})\b/g,
      parse: (match) => parseNumericDate(match[1], match[2], match[3], match[0]),
    },
    {
      regex: new RegExp(
        String.raw`\b(${MONTH_PATTERN})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b`,
        "gi",
      ),
      parse: (match) => {
        const month = MONTHS[match[1].toLowerCase()];
        const day = Number(match[2]);
        const year = Number(match[3]);
        if (!month || !isValidYmd(year, month, day)) {
          return {
            value: null,
            status: "INVALID",
            reason: "The date is not a valid calendar date.",
          };
        }
        return {
          value: ymd(year, month, day),
          status: "EXTRACTED",
          reason: "Read as month day, year.",
        };
      },
    },
    {
      regex: new RegExp(
        String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${MONTH_PATTERN})\.?,?\s+(\d{4})\b`,
        "gi",
      ),
      parse: (match) => {
        const day = Number(match[1]);
        const month = MONTHS[match[2].toLowerCase()];
        const year = Number(match[3]);
        if (!month || !isValidYmd(year, month, day)) {
          return {
            value: null,
            status: "INVALID",
            reason: "The date is not a valid calendar date.",
          };
        }
        return {
          value: ymd(year, month, day),
          status: "EXTRACTED",
          reason: "Read as day month year.",
        };
      },
    },
  ];

  let lineIndex = 0;
  for (const line of text.split("\n")) {
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.regex.exec(line)) !== null) {
        const raw = match[0];
        candidates.push({
          raw,
          index: match.index,
          lineIndex,
          ...pattern.parse(match),
        });
      }
    }
    lineIndex += 1;
  }

  // Prefer the longest match when patterns overlap (for example an ISO date
  // also matching the two-digit-year numeric pattern).
  const sorted = candidates.sort((a, b) => a.lineIndex - b.lineIndex || a.index - b.index);
  const kept: DateCandidate[] = [];
  for (const candidate of sorted) {
    const overlaps = kept.some(
      (existing) =>
        existing.lineIndex === candidate.lineIndex &&
        candidate.index < existing.index + existing.raw.length &&
        existing.index < candidate.index + candidate.raw.length,
    );
    if (!overlaps) {
      kept.push(candidate);
      continue;
    }
    const existingIndex = kept.findIndex(
      (existing) =>
        existing.lineIndex === candidate.lineIndex &&
        candidate.index < existing.index + existing.raw.length &&
        existing.index < candidate.index + candidate.raw.length,
    );
    if (existingIndex >= 0 && candidate.raw.length > kept[existingIndex].raw.length) {
      kept[existingIndex] = candidate;
    }
  }

  return kept;
}

function summarizeDateCandidates(
  candidates: DateCandidate[],
  words: OcrWord[],
  line: string | null,
): Pick<OcrSuggestion, "value" | "confidence" | "evidence" | "extractionStatus"> {
  if (!candidates.length) {
    return { value: null, confidence: null, evidence: null, extractionStatus: "MISSING" };
  }

  const distinctValues = new Set(candidates.map((candidate) => candidate.value));
  if (distinctValues.size > 1 || candidates.some((candidate) => candidate.status !== "EXTRACTED")) {
    const ambiguous = candidates.find((candidate) => candidate.status !== "EXTRACTED");
    return {
      value: null,
      confidence: null,
      evidence: candidates.map((candidate) => candidate.raw).join(" | "),
      extractionStatus: ambiguous?.status === "INVALID" ? "INVALID" : "AMBIGUOUS",
    };
  }

  const candidate = candidates[0];
  return {
    value: candidate.value,
    confidence: line ? lineConfidence(line, words) : null,
    evidence: line ?? candidate.raw,
    extractionStatus: candidate.status,
  };
}

function timeContext(line: string): boolean {
  return /\b(?:time|timing|starts?|begins?|ends?)\b|a\.?m\.?|p\.?m\.?|:/i.test(line);
}

function parseTimeToken(
  hourValue: string,
  minuteValue: string | undefined,
  meridiemValue: string | undefined,
): TimeValue {
  const hour = Number(hourValue);
  const minute = minuteValue === undefined ? 0 : Number(minuteValue);

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    return { value: null, status: "INVALID", reason: "The time is not a valid clock time." };
  }

  const meridiem = meridiemValue?.toLowerCase().replace(/\./g, "");

  if (meridiem === "am" || meridiem === "pm") {
    if (hour < 1 || hour > 12) {
      return { value: null, status: "INVALID", reason: "A 12-hour time must be between 1 and 12." };
    }
    const converted = meridiem === "pm" ? (hour % 12) + 12 : hour % 12;
    return {
      value: `${String(converted).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      status: "EXTRACTED",
      reason: "Read with an explicit AM/PM marker.",
    };
  }

  if (hour >= 13 && hour <= 23) {
    return {
      value: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      status: "EXTRACTED",
      reason: "Read as a 24-hour time.",
    };
  }

  if (hour === 0) {
    return {
      value: `00:${String(minute).padStart(2, "0")}`,
      status: "EXTRACTED",
      reason: "Read as a 24-hour time.",
    };
  }

  return {
    value: null,
    status: "AMBIGUOUS",
    reason: `The time "${hourValue}${minuteValue ? `:${minuteValue}` : ""}" has no AM/PM marker; confirm it manually.`,
  };
}

function extractTimeRange(line: string): TimeRange | null {
  if (!timeContext(line)) {
    return null;
  }

  const range = line.match(
    /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?\s*(?:-|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i,
  );

  if (range) {
    return {
      start: parseTimeToken(range[1], range[2], range[3]),
      end: parseTimeToken(range[4], range[5], range[6]),
      evidence: line,
    };
  }

  const single = line.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (single) {
    return {
      start: parseTimeToken(single[1], single[2], single[3]),
      end: { value: null, status: "MISSING", reason: "No end time was found." },
      evidence: line,
    };
  }

  return null;
}

function findLabeledLine(
  lines: string[],
  labelPattern: string,
): { line: string; value: string; lineIndex: number } | null {
  const regex = new RegExp(String.raw`^\s*(?:${labelPattern})\s*[:\-]\s*(.+)$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(regex);
    if (match?.[1]?.trim()) {
      return { line: lines[index], value: match[1].trim(), lineIndex: index };
    }
  }
  return null;
}

function findVenue(
  lines: string[],
  words: OcrWord[],
): Pick<OcrSuggestion, "value" | "confidence" | "evidence" | "extractionStatus"> {
  const labeled = findLabeledLine(lines, VENUE_LABEL);
  if (labeled) {
    return {
      value: labeled.value,
      confidence: lineConfidence(labeled.line, words),
      evidence: labeled.line,
      extractionStatus: "EXTRACTED",
    };
  }

  const venueWords =
    /\b(?:auditorium|hall|laboratory|lab|room|block|ground|campus|centre|center|library|amphitheatre|amphitheater|convention|seminar room)\b/i;
  const candidates = lines.filter(
    (line) =>
      venueWords.test(line) && !/\b(?:date|time|deadline|contact|email|phone)\b/i.test(line),
  );

  if (candidates.length === 1) {
    return {
      value: candidates[0],
      confidence: lineConfidence(candidates[0], words),
      evidence: candidates[0],
      extractionStatus: "EXTRACTED",
    };
  }

  if (candidates.length > 1) {
    return {
      value: null,
      confidence: null,
      evidence: candidates.join(" | "),
      extractionStatus: "AMBIGUOUS",
    };
  }

  return { value: null, confidence: null, evidence: null, extractionStatus: "MISSING" };
}

function findOrganizer(
  lines: string[],
  words: OcrWord[],
): Pick<OcrSuggestion, "value" | "confidence" | "evidence" | "extractionStatus"> {
  const regex = new RegExp(String.raw`^\s*(?:${ORGANIZER_LABEL})\s*[:\-]?\s*(.+)$`, "i");
  const line = lines.find((candidate) => regex.test(candidate));
  if (!line) {
    return { value: null, confidence: null, evidence: null, extractionStatus: "MISSING" };
  }

  const match = line.match(regex);
  const value = match?.[1]?.trim();
  if (!value) {
    return { value: null, confidence: null, evidence: line, extractionStatus: "MISSING" };
  }

  return {
    value,
    confidence: lineConfidence(line, words),
    evidence: line,
    extractionStatus: "EXTRACTED",
  };
}

function findContact(
  lines: string[],
  words: OcrWord[],
): Pick<OcrSuggestion, "value" | "confidence" | "evidence" | "extractionStatus"> {
  const contactRegex =
    /\b(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d\s-]{7,}\d)|(?:https?:\/\/|www\.)\S+)\b/i;
  const labeled = lines.find((line) =>
    new RegExp(String.raw`\b(?:${CONTACT_LABEL})\b`, "i").test(line),
  );
  const line = labeled ?? lines.find((candidate) => contactRegex.test(candidate));
  if (!line) {
    return { value: null, confidence: null, evidence: null, extractionStatus: "MISSING" };
  }

  const match = line.match(contactRegex);
  const value =
    match?.[0]?.trim() ??
    line.replace(new RegExp(String.raw`^\s*(?:${CONTACT_LABEL})\s*[:\-]\s*`, "i"), "").trim();
  if (!value) {
    return { value: null, confidence: null, evidence: line, extractionStatus: "MISSING" };
  }

  return {
    value,
    confidence: lineConfidence(line, words),
    evidence: line,
    extractionStatus: "EXTRACTED",
  };
}

function isTitleCandidate(line: string): boolean {
  if (line.length < 3 || line.length > 180) {
    return false;
  }
  if (!/[a-z]{3}/i.test(line)) {
    return false;
  }
  if (
    new RegExp(
      String.raw`^\s*(?:${DATE_LABEL}|${DEADLINE_LABEL}|${TIME_LABEL}|${VENUE_LABEL}|${ORGANIZER_LABEL}|${CONTACT_LABEL})\b`,
      "i",
    ).test(line)
  ) {
    return false;
  }
  if (/@|https?:\/\/|www\./i.test(line)) {
    return false;
  }
  if (
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i.test(line) &&
    /\d{4}/.test(line)
  ) {
    return false;
  }
  return !/^(?:event|poster|invitation|notice|announcement)$/i.test(line);
}

function findTitle(
  lines: string[],
  words: OcrWord[],
): {
  value: string | null;
  lineIndex: number;
  suggestion: Pick<OcrSuggestion, "value" | "confidence" | "evidence" | "extractionStatus">;
} {
  for (let index = 0; index < Math.min(lines.length, 8); index += 1) {
    const line = lines[index];
    if (isTitleCandidate(line)) {
      return {
        value: line,
        lineIndex: index,
        suggestion: {
          value: line,
          confidence: lineConfidence(line, words),
          evidence: line,
          extractionStatus: "EXTRACTED",
        },
      };
    }
  }

  return {
    value: null,
    lineIndex: -1,
    suggestion: { value: null, confidence: null, evidence: null, extractionStatus: "MISSING" },
  };
}

function findDescription(
  lines: string[],
  titleLineIndex: number,
  words: OcrWord[],
): Pick<OcrSuggestion, "value" | "confidence" | "evidence" | "extractionStatus"> {
  const excluded = new RegExp(
    String.raw`^\s*(?:${DATE_LABEL}|${DEADLINE_LABEL}|${TIME_LABEL}|${VENUE_LABEL}|${ORGANIZER_LABEL}|${CONTACT_LABEL})\b`,
    "i",
  );
  const descriptive = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => {
      if (index === titleLineIndex || excluded.test(line)) {
        return false;
      }
      if (/@|https?:\/\/|www\.|\b(?:register|registration)\b/i.test(line)) {
        return false;
      }
      if (/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/.test(line) || /\b\d{1,2}:\d{2}\b/.test(line)) {
        return false;
      }
      return line.length >= 12;
    })
    .map(({ line }) => line);

  if (!descriptive.length) {
    return { value: null, confidence: null, evidence: null, extractionStatus: "MISSING" };
  }

  const description = descriptive.join(" ").slice(0, 5_000);
  return {
    value: description,
    confidence: lineConfidence(descriptive.join(" "), words),
    evidence: descriptive.join(" "),
    extractionStatus: "EXTRACTED",
  };
}

function findCategory(
  text: string,
  categories: OcrCategoryOption[],
): Pick<OcrSuggestion, "value" | "confidence" | "evidence" | "extractionStatus"> {
  if (!categories.length) {
    return { value: null, confidence: null, evidence: null, extractionStatus: "MISSING" };
  }

  const haystack = ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")} `;
  const matches = categories
    .map((category) => {
      const slugParts = category.slug.split("-").filter((part) => part.length >= 3);
      const nameParts = category.name
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((part) => part.length >= 3 && !["and", "the"].includes(part));
      const generic = Object.entries(CATEGORY_KEYWORDS)
        .filter(([key]) => category.slug.includes(key))
        .flatMap(([, values]) => values);
      const terms = Array.from(new Set([...slugParts, ...nameParts, ...generic]))
        .map((term) => term.toLowerCase().trim())
        .filter(Boolean);
      const matched = terms
        .filter((term) => haystack.includes(` ${term} `))
        .sort((a, b) => b.length - a.length);
      return { category, matched };
    })
    .filter(({ matched }) => matched.length > 0)
    .sort((a, b) => b.matched[0].length - a.matched[0].length);

  if (!matches.length) {
    return { value: null, confidence: null, evidence: null, extractionStatus: "MISSING" };
  }

  const best = matches[0];
  const tied = matches.filter((match) => match.matched[0].length === best.matched[0].length);
  if (tied.length > 1) {
    return {
      value: null,
      confidence: null,
      evidence: tied.map(({ category, matched }) => `${category.name} (${matched[0]})`).join(" | "),
      extractionStatus: "AMBIGUOUS",
    };
  }

  return {
    value: best.category.id,
    confidence: null,
    evidence: `${best.category.name} matched "${best.matched[0]}"`,
    extractionStatus: "EXTRACTED",
  };
}

export function extractPosterFields(input: OcrExtractionInput): OcrExtractionResult {
  const text = normalizeOcrText(input.text);
  const lines = text ? text.split("\n") : [];
  const words = input.words ?? [];
  const suggestions = new Map<PosterOcrFieldName, OcrSuggestion>();

  const title = findTitle(lines, words);
  suggestions.set("TITLE", suggestion("TITLE", title.suggestion));

  const description = findDescription(lines, title.lineIndex, words);
  suggestions.set("DESCRIPTION", suggestion("DESCRIPTION", description));
  suggestions.set(
    "SUMMARY",
    suggestion("SUMMARY", {
      value: description.value ? description.value.slice(0, 500) : null,
      confidence: description.confidence,
      evidence: description.evidence,
      extractionStatus: description.value ? "EXTRACTED" : "MISSING",
    }),
  );

  const deadlineLineIndex = lines.findIndex((line) =>
    new RegExp(String.raw`\b(?:${DEADLINE_LABEL})\b`, "i").test(line),
  );
  const allDateCandidates = collectDateCandidates(text);
  const deadlineDateCandidates = collectDateCandidates(
    deadlineLineIndex >= 0 ? lines[deadlineLineIndex] : "",
  );
  const eventDateCandidates = allDateCandidates.filter(
    (candidate) =>
      !deadlineDateCandidates.some(
        (deadline) =>
          deadline.lineIndex === 0 &&
          candidate.lineIndex === deadlineLineIndex &&
          candidate.raw === deadline.raw &&
          candidate.index === deadline.index,
      ),
  );

  const eventDate = summarizeDateCandidates(
    eventDateCandidates,
    words,
    eventDateCandidates.length ? lines[eventDateCandidates[0].lineIndex] : null,
  );
  suggestions.set("START_DATE", suggestion("START_DATE", eventDate));
  suggestions.set(
    "END_DATE",
    suggestion("END_DATE", {
      value: null,
      confidence: null,
      evidence:
        eventDateCandidates.length > 1
          ? eventDateCandidates.map((candidate) => candidate.raw).join(" | ")
          : null,
      extractionStatus: eventDateCandidates.length > 1 ? "AMBIGUOUS" : "MISSING",
    }),
  );

  const deadlineDate = summarizeDateCandidates(
    deadlineDateCandidates,
    words,
    deadlineLineIndex >= 0 ? lines[deadlineLineIndex] : null,
  );
  suggestions.set(
    "REGISTRATION_DEADLINE_DATE",
    suggestion("REGISTRATION_DEADLINE_DATE", deadlineDate),
  );

  const timeLines = lines
    .map((line, index) => ({ line, index }))
    .filter(
      ({ line }) =>
        timeContext(line) && !new RegExp(String.raw`\b(?:${DEADLINE_LABEL})\b`, "i").test(line),
    );
  const ranges = timeLines
    .map(({ line }) => extractTimeRange(line))
    .filter((range): range is TimeRange => range !== null);

  const deadlineRange = deadlineLineIndex >= 0 ? extractTimeRange(lines[deadlineLineIndex]) : null;

  if (ranges.length === 0) {
    suggestions.set("START_TIME", suggestion("START_TIME", { extractionStatus: "MISSING" }));
    suggestions.set("END_TIME", suggestion("END_TIME", { extractionStatus: "MISSING" }));
  } else {
    const firstRange = ranges[0];
    const distinctStarts = new Set(ranges.map((range) => range.start.value));
    const distinctEnds = new Set(ranges.map((range) => range.end.value));
    const ambiguousStart = ranges.length > 1 && distinctStarts.size > 1;
    const ambiguousEnd = ranges.length > 1 && distinctEnds.size > 1;

    suggestions.set(
      "START_TIME",
      suggestion("START_TIME", {
        value: ambiguousStart ? null : firstRange.start.value,
        confidence: null,
        evidence: ranges.map((range) => range.evidence).join(" | "),
        extractionStatus: ambiguousStart ? "AMBIGUOUS" : firstRange.start.status,
      }),
    );
    suggestions.set(
      "END_TIME",
      suggestion("END_TIME", {
        value: ambiguousEnd ? null : firstRange.end.value,
        confidence: null,
        evidence: ranges.map((range) => range.evidence).join(" | "),
        extractionStatus: ambiguousEnd ? "AMBIGUOUS" : firstRange.end.status,
      }),
    );
  }

  suggestions.set(
    "REGISTRATION_DEADLINE_TIME",
    suggestion(
      "REGISTRATION_DEADLINE_TIME",
      deadlineRange
        ? {
            value: deadlineRange.start.value,
            confidence: null,
            evidence: deadlineRange.evidence,
            extractionStatus: deadlineRange.start.status,
          }
        : { extractionStatus: "MISSING" },
    ),
  );

  const venue = findVenue(lines, words);
  suggestions.set("VENUE", suggestion("VENUE", venue));
  const venueAddress = findLabeledLine(lines, String.raw`address`);
  suggestions.set(
    "VENUE_ADDRESS",
    suggestion("VENUE_ADDRESS", {
      value: venueAddress?.value ?? null,
      confidence: venueAddress ? lineConfidence(venueAddress.line, words) : null,
      evidence: venueAddress?.line ?? null,
      extractionStatus: venueAddress ? "EXTRACTED" : "MISSING",
    }),
  );

  suggestions.set("ORGANIZER", suggestion("ORGANIZER", findOrganizer(lines, words)));
  suggestions.set("CONTACT", suggestion("CONTACT", findContact(lines, words)));
  suggestions.set("CATEGORY", suggestion("CATEGORY", findCategory(text, input.categories)));

  return {
    text,
    suggestions: FIELD_ORDER.map(
      (field) => suggestions.get(field) ?? suggestion(field, { extractionStatus: "MISSING" }),
    ),
  };
}
