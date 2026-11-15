import { describe, expect, it } from "vitest";

import { extractPosterFields } from "@/server/ocr/extract";

const categories = [
  { id: "category-technology", name: "Technology", slug: "technology" },
  { id: "category-arts", name: "Arts & Culture", slug: "arts-culture" },
];

function field(result: ReturnType<typeof extractPosterFields>, name: string) {
  const suggestion = result.suggestions.find((entry) => entry.field === name);
  if (!suggestion) {
    throw new Error(`Missing OCR field ${name}`);
  }
  return suggestion;
}

describe("poster OCR extraction", () => {
  it("extracts reviewable event fields with local word confidence", () => {
    const result = extractPosterFields({
      text: [
        "ROBOTICS SHOWCASE",
        "Join us for a student robotics showcase.",
        "Date: 20 December 2026",
        "Time: 10:00 AM - 12:00 PM",
        "Venue: Main Auditorium",
        "Organized by Robotics Club",
        "Contact: robotics@example.edu",
        "Registration deadline: 18 December 2026",
        "Technology workshop",
      ].join("\n"),
      words: [
        { text: "ROBOTICS", confidence: 91 },
        { text: "SHOWCASE", confidence: 88 },
        { text: "Venue:", confidence: 95 },
      ],
      categories,
      clubName: "Robotics Club",
    });

    expect(field(result, "TITLE")).toMatchObject({
      value: "ROBOTICS SHOWCASE",
      confidence: 89.5,
      extractionStatus: "EXTRACTED",
      requiresReview: true,
    });
    expect(field(result, "START_DATE")).toMatchObject({
      value: "2026-12-20",
      confidence: null,
      extractionStatus: "EXTRACTED",
      requiresReview: true,
    });
    expect(field(result, "START_TIME")).toMatchObject({
      value: "10:00",
      extractionStatus: "EXTRACTED",
    });
    expect(field(result, "END_TIME")).toMatchObject({
      value: "12:00",
      extractionStatus: "EXTRACTED",
    });
    expect(field(result, "VENUE")).toMatchObject({
      value: "Main Auditorium",
      extractionStatus: "EXTRACTED",
    });
    expect(field(result, "ORGANIZER")).toMatchObject({
      value: "Robotics Club",
      extractionStatus: "EXTRACTED",
    });
    expect(field(result, "CONTACT")).toMatchObject({
      value: "robotics@example.edu",
      extractionStatus: "EXTRACTED",
    });
    expect(field(result, "REGISTRATION_DEADLINE_DATE")).toMatchObject({
      value: "2026-12-18",
      extractionStatus: "EXTRACTED",
    });
    expect(field(result, "CATEGORY")).toMatchObject({
      value: "category-technology",
      extractionStatus: "EXTRACTED",
    });
    expect(field(result, "END_DATE")).toMatchObject({
      value: null,
      extractionStatus: "MISSING",
      requiresReview: false,
    });
  });

  it("flags ambiguous dates and times instead of silently interpreting them", () => {
    const result = extractPosterFields({
      text: [
        "CAMPUS CULTURAL NIGHT",
        "Date: 05/06/2026",
        "Time: 5:00 - 6:00",
        "Venue: Open Air Theatre",
      ].join("\n"),
      categories,
    });

    expect(field(result, "START_DATE")).toMatchObject({
      value: null,
      extractionStatus: "AMBIGUOUS",
      requiresReview: true,
    });
    expect(field(result, "START_DATE").evidence).toContain("05/06/2026");
    expect(field(result, "START_TIME")).toMatchObject({
      value: null,
      extractionStatus: "AMBIGUOUS",
      requiresReview: true,
    });
    expect(field(result, "START_TIME").evidence).toContain("5:00 - 6:00");
  });

  it("keeps OCR text deterministic and rejects blank posters in the service layer", () => {
    const first = extractPosterFields({ text: "  Event title  \n\n", categories });
    const second = extractPosterFields({ text: "  Event title  \n\n", categories });

    expect(first).toEqual(second);
    expect(field(first, "TITLE")).toMatchObject({
      value: "Event title",
      extractionStatus: "EXTRACTED",
    });
  });
});
