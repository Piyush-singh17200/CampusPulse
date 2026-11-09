export type PreviewEvent = {
  id: string;
  title: string;
  club: string;
  category: string;
  day: string;
  month: string;
  dateLabel: string;
  time: string;
  venue: string;
  description: string;
  registration: string;
  accent: "signal" | "forest" | "gold" | "sage";
  featured?: boolean;
};

/**
 * Illustrative event data for the landing-page preview only. These are
 * fictional events at a fictional college and must never be presented as
 * production records.
 */
export const previewEvents: PreviewEvent[] = [
  {
    id: "founders-table",
    title: "Founders' Table: Building for Campus",
    club: "Entrepreneurship Cell",
    category: "Careers",
    day: "12",
    month: "NOV",
    dateLabel: "Thu, 12 Nov",
    time: "6:30 PM",
    venue: "Innovation Studio, Block C",
    description:
      "A working dinner for students building tools, communities, and small businesses on campus. Bring a problem worth solving.",
    registration: "Registration closes 10 Nov",
    accent: "signal",
    featured: true,
  },
  {
    id: "jazz-on-the-lawn",
    title: "Jazz on the Lawn",
    club: "Music Society",
    category: "Culture",
    day: "14",
    month: "NOV",
    dateLabel: "Sat, 14 Nov",
    time: "5:00 PM",
    venue: "Main Lawn",
    description:
      "An open-air set from the campus jazz ensemble. Bring a blanket, leave the week behind, and stay for the encore.",
    registration: "Open to all students",
    accent: "forest",
  },
  {
    id: "design-critique-night",
    title: "Design Critique Night",
    club: "Design Collective",
    category: "Workshops",
    day: "17",
    month: "NOV",
    dateLabel: "Tue, 17 Nov",
    time: "7:00 PM",
    venue: "Studio 2, Arts Block",
    description:
      "Bring one unfinished thing. Leave with sharper questions, useful notes, and honest feedback from people who make things.",
    registration: "Registration open",
    accent: "gold",
  },
  {
    id: "quiet-hour",
    title: "The Quiet Hour: Exam Season Reset",
    club: "Wellness Collective",
    category: "Wellbeing",
    day: "19",
    month: "NOV",
    dateLabel: "Thu, 19 Nov",
    time: "8:00 AM",
    venue: "Reading Room, Library",
    description:
      "A guided hour of focus, breathing, and a slower start to the day. Mats and tea provided; no experience needed.",
    registration: "Drop-in, no registration",
    accent: "sage",
  },
  {
    id: "hack-the-ordinary",
    title: "Hack the Ordinary",
    club: "Computer Science Society",
    category: "Technology",
    day: "21",
    month: "NOV",
    dateLabel: "Sat, 21 Nov",
    time: "10:00 AM",
    venue: "Makerspace, Engineering Wing",
    description:
      "A one-day build sprint for small ideas that make everyday campus life better. Teams of one to four; all skill levels.",
    registration: "Team registration open",
    accent: "forest",
  },
  {
    id: "open-screen",
    title: "Sunday Cinema: Open Screen",
    club: "Film Club",
    category: "Film",
    day: "22",
    month: "NOV",
    dateLabel: "Sun, 22 Nov",
    time: "4:30 PM",
    venue: "Screening Room, Media Centre",
    description:
      "Student shorts, one campus classic, and a conversation after the credits. Submit a short or come to watch.",
    registration: "Free entry",
    accent: "signal",
  },
];

export const previewCategories = [
  "All events",
  "Careers",
  "Culture",
  "Workshops",
  "Wellbeing",
  "Technology",
  "Film",
] as const;
