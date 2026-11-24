import { randomUUID } from "node:crypto";
import { config as loadEnv } from "dotenv";
import { hash } from "@node-rs/argon2";

import { createDatabaseClient } from "../src/server/db/factory";
import { assertDevelopmentDatabaseUrl, getDatabaseConfig } from "../src/server/db/config";
import type {
  ClubStatus,
  EventStatus,
  NotificationType,
  RegistrationStatus,
  UserRole,
} from "../src/generated/prisma/enums";

loadEnv({ path: ".env.local" });

const confirmed = process.argv.includes("--confirm-development-seed");

if (!confirmed) {
  console.error("Refusing to seed. Re-run with: npm run db:seed -- --confirm-development-seed");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

assertDevelopmentDatabaseUrl(databaseUrl);

const prisma = createDatabaseClient(getDatabaseConfig({ applicationName: "campuspulse-seed" }));

const now = new Date();
const day = 24 * 60 * 60 * 1000;

function daysFromNow(days: number, hours = 10, minutes = 0): Date {
  // Seed colleges use Asia/Kolkata. Build the date at a predictable local hour
  // instead of inheriting the current clock time from whenever the seed runs.
  const utc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + days,
    hours,
    minutes,
  );

  return new Date(utc - 5.5 * 60 * 60 * 1000);
}

async function upsertCollege(input: {
  slug: string;
  name: string;
  shortName: string;
  primaryDomain: string;
}) {
  return prisma.college.upsert({
    where: { slug: input.slug },
    update: {
      name: input.name,
      shortName: input.shortName,
      primaryDomain: input.primaryDomain,
      timezone: "Asia/Kolkata",
      status: "ACTIVE",
    },
    create: {
      slug: input.slug,
      name: input.name,
      shortName: input.shortName,
      primaryDomain: input.primaryDomain,
      timezone: "Asia/Kolkata",
      status: "ACTIVE",
      settings: { demoData: true },
    },
  });
}

const DEMO_PASSWORD = "CampusPulse!2026";
let demoPasswordHashPromise: Promise<string> | null = null;

async function getDemoPasswordHash(): Promise<string> {
  if (!demoPasswordHashPromise) {
    demoPasswordHashPromise = hash(DEMO_PASSWORD, {
      algorithm: 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
      outputLen: 32,
    });
  }
  return demoPasswordHashPromise;
}

async function upsertUser(input: {
  email: string;
  name: string;
  role: UserRole;
  collegeId: string | null;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: {
      name: input.name,
      role: input.role,
      collegeId: input.collegeId,
      status: "ACTIVE",
    },
    create: {
      email: input.email,
      name: input.name,
      role: input.role,
      collegeId: input.collegeId,
      status: "ACTIVE",
    },
  });

  const passwordHash = await getDemoPasswordHash();
  const existingAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { id: true },
  });

  if (existingAccount) {
    await prisma.account.update({
      where: { id: existingAccount.id },
      data: { password: passwordHash },
    });
  } else {
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });
  }

  return user;
}

async function upsertStudent(input: {
  email: string;
  name: string;
  collegeId: string;
  rollNumber: string;
  department: string;
  graduationYear: number;
}) {
  const user = await upsertUser({
    email: input.email,
    name: input.name,
    role: "STUDENT",
    collegeId: input.collegeId,
  });

  const profile = await prisma.studentProfile.upsert({
    where: {
      userId_collegeId: { userId: user.id, collegeId: input.collegeId },
    },
    update: {
      rollNumber: input.rollNumber,
      department: input.department,
      graduationYear: input.graduationYear,
      bio: "Fictional student profile for local development.",
    },
    create: {
      userId: user.id,
      collegeId: input.collegeId,
      rollNumber: input.rollNumber,
      department: input.department,
      graduationYear: input.graduationYear,
      bio: "Fictional student profile for local development.",
    },
  });

  return { user, profile };
}

async function upsertClub(input: {
  collegeId: string;
  createdById: string;
  name: string;
  slug: string;
  description: string;
  status: ClubStatus;
}) {
  const approvedAt = input.status === "ACTIVE" ? now : null;

  return prisma.club.upsert({
    where: {
      collegeId_slug: { collegeId: input.collegeId, slug: input.slug },
    },
    update: {
      name: input.name,
      description: input.description,
      status: input.status,
      approvedAt,
      statusReason: input.status === "PENDING" ? "Awaiting college administrator review." : null,
    },
    create: {
      collegeId: input.collegeId,
      createdById: input.createdById,
      name: input.name,
      slug: input.slug,
      description: input.description,
      status: input.status,
      approvedAt,
      statusReason: input.status === "PENDING" ? "Awaiting college administrator review." : null,
    },
  });
}

async function upsertMembership(input: {
  collegeId: string;
  clubId: string;
  userId: string;
  role: "PRESIDENT" | "OFFICER" | "MEMBER";
}) {
  return prisma.clubMembership.upsert({
    where: {
      clubId_userId: { clubId: input.clubId, userId: input.userId },
    },
    update: {
      collegeId: input.collegeId,
      role: input.role,
      status: "ACTIVE",
    },
    create: {
      collegeId: input.collegeId,
      clubId: input.clubId,
      userId: input.userId,
      role: input.role,
      status: "ACTIVE",
    },
  });
}

async function upsertCategory(input: {
  collegeId: string;
  name: string;
  slug: string;
  sortOrder: number;
}) {
  return prisma.category.upsert({
    where: {
      collegeId_slug: { collegeId: input.collegeId, slug: input.slug },
    },
    update: {
      name: input.name,
      sortOrder: input.sortOrder,
      isActive: true,
    },
    create: {
      collegeId: input.collegeId,
      name: input.name,
      slug: input.slug,
      sortOrder: input.sortOrder,
      isActive: true,
    },
  });
}

function registrationWindow(startsAt: Date) {
  const deadline = new Date(startsAt.getTime() - day);
  const opens =
    deadline > now ? new Date(now.getTime() - day) : new Date(startsAt.getTime() - 10 * day);

  return { registrationOpensAt: opens, registrationDeadline: deadline };
}

async function upsertEvent(input: {
  collegeId: string;
  clubId: string;
  createdById: string;
  title: string;
  slug: string;
  summary: string;
  description: string;
  status: EventStatus;
  startsAt: Date;
  endsAt: Date;
  venueName: string;
  venueAddress?: string;
  capacity: number;
  isOnline?: boolean;
  onlineUrl?: string;
  rejectionReason?: string;
  cancellationReason?: string;
}) {
  const window = registrationWindow(input.startsAt);
  const publishedAt = input.status === "PUBLISHED" || input.status === "COMPLETED" ? now : null;
  const rejectedAt = input.status === "REJECTED" ? now : null;
  const cancelledAt = input.status === "CANCELLED" ? now : null;
  const completedAt = input.status === "COMPLETED" ? now : null;
  const data = {
    collegeId: input.collegeId,
    clubId: input.clubId,
    createdById: input.createdById,
    title: input.title,
    slug: input.slug,
    summary: input.summary,
    description: input.description,
    status: input.status,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    registrationOpensAt: window.registrationOpensAt,
    registrationDeadline: window.registrationDeadline,
    venueName: input.venueName,
    venueAddress: input.venueAddress ?? null,
    isOnline: input.isOnline ?? false,
    onlineUrl: input.onlineUrl ?? null,
    capacity: input.capacity,
    publishedAt,
    rejectedAt,
    rejectionReason: input.rejectionReason ?? null,
    cancelledAt,
    cancellationReason: input.cancellationReason ?? null,
    completedAt,
  };

  return prisma.event.upsert({
    where: {
      collegeId_slug: { collegeId: input.collegeId, slug: input.slug },
    },
    update: data,
    create: data,
  });
}

async function upsertEventCategory(input: {
  collegeId: string;
  eventId: string;
  categoryId: string;
}) {
  return prisma.eventCategory.upsert({
    where: {
      eventId_categoryId: {
        eventId: input.eventId,
        categoryId: input.categoryId,
      },
    },
    update: { collegeId: input.collegeId },
    create: {
      collegeId: input.collegeId,
      eventId: input.eventId,
      categoryId: input.categoryId,
    },
  });
}

async function upsertRegistration(input: {
  collegeId: string;
  eventId: string;
  studentProfileId: string;
  status: RegistrationStatus;
}) {
  const data = {
    collegeId: input.collegeId,
    eventId: input.eventId,
    studentProfileId: input.studentProfileId,
    status: input.status,
    cancelledAt: input.status === "CANCELLED" ? now : null,
    checkedInAt: input.status === "ATTENDED" ? now : null,
  };

  return prisma.eventRegistration.upsert({
    where: {
      eventId_studentProfileId: {
        eventId: input.eventId,
        studentProfileId: input.studentProfileId,
      },
    },
    update: data,
    create: data,
  });
}

async function upsertNotification(input: {
  id: string;
  collegeId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl: string;
  readAt?: Date;
  createdAt: Date;
}) {
  const data = {
    collegeId: input.collegeId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    actionUrl: input.actionUrl,
    readAt: input.readAt ?? null,
    createdAt: input.createdAt,
  };

  return prisma.notification.upsert({
    where: { id: input.id },
    update: data,
    create: { id: input.id, ...data },
  });
}

async function main() {
  const northfield = await upsertCollege({
    slug: "northfield-university",
    name: "Northfield University (Demo)",
    shortName: "Northfield",
    primaryDomain: "northfield.example.edu",
  });
  const lakeview = await upsertCollege({
    slug: "lakeview-institute",
    name: "Lakeview Institute (Demo)",
    shortName: "Lakeview",
    primaryDomain: "lakeview.example.edu",
  });

  const interestSpecs = [
    ["Technology", "technology", 1],
    ["Arts & Culture", "arts-culture", 2],
    ["Sports & Wellness", "sports-wellness", 3],
    ["Community Service", "community-service", 4],
    ["Career & Entrepreneurship", "career-entrepreneurship", 5],
    ["Environment", "environment", 6],
    ["Media & Communication", "media-communication", 7],
  ] as const;

  const interests = new Map<string, { id: string }>();

  for (const [name, slug, sortOrder] of interestSpecs) {
    const interest = await prisma.interest.upsert({
      where: { slug },
      update: { name, sortOrder, isActive: true },
      create: {
        name,
        slug,
        description: `Fictional ${name.toLowerCase()} interest for local development.`,
        sortOrder,
        isActive: true,
      },
    });
    interests.set(slug, interest);
  }

  const categorySpecs = [
    ["Academic", "academic", 1],
    ["Arts & Culture", "arts-culture", 2],
    ["Sports", "sports", 3],
    ["Community", "community", 4],
    ["Career", "career", 5],
  ] as const;

  const northfieldCategories = new Map<string, { id: string }>();
  const lakeviewCategories = new Map<string, { id: string }>();

  for (const [name, slug, sortOrder] of categorySpecs) {
    northfieldCategories.set(
      slug,
      await upsertCategory({
        collegeId: northfield.id,
        name,
        slug,
        sortOrder,
      }),
    );
    lakeviewCategories.set(
      slug,
      await upsertCategory({
        collegeId: lakeview.id,
        name,
        slug,
        sortOrder,
      }),
    );
  }

  const platformAdmin = await upsertUser({
    email: "platform.admin@campuspulse.example",
    name: "Platform Admin (Demo)",
    role: "SUPER_ADMIN",
    collegeId: null,
  });
  const northfieldAdmin = await upsertUser({
    email: "northfield.admin@campuspulse.example",
    name: "Northfield College Admin (Demo)",
    role: "COLLEGE_ADMIN",
    collegeId: northfield.id,
  });
  const lakeviewAdmin = await upsertUser({
    email: "lakeview.admin@campuspulse.example",
    name: "Lakeview College Admin (Demo)",
    role: "COLLEGE_ADMIN",
    collegeId: lakeview.id,
  });

  const roboticsPresident = await upsertUser({
    email: "robotics.president@campuspulse.example",
    name: "Aarav Mehta (Demo)",
    role: "CLUB_ADMIN",
    collegeId: northfield.id,
  });
  const debatePresident = await upsertUser({
    email: "debate.president@campuspulse.example",
    name: "Sara Khan (Demo)",
    role: "CLUB_ADMIN",
    collegeId: northfield.id,
  });
  const photoPresident = await upsertUser({
    email: "photo.president@campuspulse.example",
    name: "Maya Patel (Demo)",
    role: "CLUB_ADMIN",
    collegeId: lakeview.id,
  });

  const isha = await upsertStudent({
    email: "isha.rao@campuspulse.example",
    name: "Isha Rao (Demo)",
    collegeId: northfield.id,
    rollNumber: "NF-2027-001",
    department: "Computer Science",
    graduationYear: 2027,
  });
  const dev = await upsertStudent({
    email: "dev.shah@campuspulse.example",
    name: "Dev Shah (Demo)",
    collegeId: northfield.id,
    rollNumber: "NF-2027-002",
    department: "Mechanical Engineering",
    graduationYear: 2027,
  });
  const nina = await upsertStudent({
    email: "nina.joseph@campuspulse.example",
    name: "Nina Joseph (Demo)",
    collegeId: northfield.id,
    rollNumber: "NF-2026-003",
    department: "Design",
    graduationYear: 2026,
  });
  const omar = await upsertStudent({
    email: "omar.ali@campuspulse.example",
    name: "Omar Ali (Demo)",
    collegeId: lakeview.id,
    rollNumber: "LV-2027-001",
    department: "Environmental Science",
    graduationYear: 2027,
  });
  const priya = await upsertStudent({
    email: "priya.nair@campuspulse.example",
    name: "Priya Nair (Demo)",
    collegeId: lakeview.id,
    rollNumber: "LV-2026-002",
    department: "Media Studies",
    graduationYear: 2026,
  });
  const lucy = await upsertStudent({
    email: "lucy.chen@campuspulse.example",
    name: "Lucy Chen (Demo)",
    collegeId: lakeview.id,
    rollNumber: "LV-2028-003",
    department: "Business",
    graduationYear: 2028,
  });

  const robotics = await upsertClub({
    collegeId: northfield.id,
    createdById: roboticsPresident.id,
    name: "Northfield Robotics Society (Demo)",
    slug: "robotics-society",
    description: "A fictional student club for robotics projects and workshops.",
    status: "ACTIVE",
  });
  const debate = await upsertClub({
    collegeId: northfield.id,
    createdById: debatePresident.id,
    name: "Northfield Debate Circle (Demo)",
    slug: "debate-circle",
    description: "A fictional club for public speaking and debate practice.",
    status: "ACTIVE",
  });
  const film = await upsertClub({
    collegeId: northfield.id,
    createdById: debatePresident.id,
    name: "Northfield Film Club (Demo)",
    slug: "film-club",
    description: "A fictional club for screenings and film discussions.",
    status: "ACTIVE",
  });
  const photography = await upsertClub({
    collegeId: lakeview.id,
    createdById: photoPresident.id,
    name: "Lakeview Photography Collective (Demo)",
    slug: "photography-collective",
    description: "A fictional collective for photography walks and exhibitions.",
    status: "ACTIVE",
  });
  const greenTeam = await upsertClub({
    collegeId: lakeview.id,
    createdById: photoPresident.id,
    name: "Lakeview Green Team (Demo)",
    slug: "green-team",
    description: "A fictional club focused on campus sustainability projects.",
    status: "PENDING",
  });

  for (const membership of [
    {
      collegeId: northfield.id,
      clubId: robotics.id,
      userId: roboticsPresident.id,
      role: "PRESIDENT" as const,
    },
    {
      collegeId: northfield.id,
      clubId: debate.id,
      userId: debatePresident.id,
      role: "PRESIDENT" as const,
    },
    {
      collegeId: lakeview.id,
      clubId: photography.id,
      userId: photoPresident.id,
      role: "PRESIDENT" as const,
    },
    {
      collegeId: northfield.id,
      clubId: robotics.id,
      userId: isha.user.id,
      role: "MEMBER" as const,
    },
    { collegeId: northfield.id, clubId: robotics.id, userId: dev.user.id, role: "MEMBER" as const },
    { collegeId: northfield.id, clubId: debate.id, userId: nina.user.id, role: "MEMBER" as const },
    { collegeId: northfield.id, clubId: film.id, userId: dev.user.id, role: "MEMBER" as const },
    {
      collegeId: lakeview.id,
      clubId: photography.id,
      userId: omar.user.id,
      role: "MEMBER" as const,
    },
    {
      collegeId: lakeview.id,
      clubId: photography.id,
      userId: priya.user.id,
      role: "MEMBER" as const,
    },
    { collegeId: lakeview.id, clubId: greenTeam.id, userId: lucy.user.id, role: "MEMBER" as const },
  ]) {
    await upsertMembership(membership);
  }

  for (const [profile, interestSlugs] of [
    [isha.profile, ["technology", "career-entrepreneurship"]],
    [dev.profile, ["technology", "sports-wellness"]],
    [nina.profile, ["arts-culture", "media-communication"]],
    [omar.profile, ["environment", "community-service"]],
    [priya.profile, ["arts-culture", "media-communication"]],
    [lucy.profile, ["career-entrepreneurship", "community-service"]],
  ] as const) {
    for (const slug of interestSlugs) {
      const interest = interests.get(slug);
      if (!interest) {
        throw new Error(`Seed interest not found: ${slug}`);
      }

      await prisma.studentInterest.upsert({
        where: {
          studentProfileId_interestId: {
            studentProfileId: profile.id,
            interestId: interest.id,
          },
        },
        update: { collegeId: profile.collegeId },
        create: {
          collegeId: profile.collegeId,
          studentProfileId: profile.id,
          interestId: interest.id,
        },
      });
    }
  }

  const roboticsExpo = await upsertEvent({
    collegeId: northfield.id,
    clubId: robotics.id,
    createdById: roboticsPresident.id,
    title: "Northfield Robotics Expo 2026 (Demo)",
    slug: "robotics-expo-2026",
    summary: "Student-built robots, demos, and a friendly design challenge.",
    description:
      "A fictional robotics expo for local development. Teams demonstrate prototypes and share what they learned.",
    status: "PUBLISHED",
    startsAt: daysFromNow(14, 10),
    endsAt: daysFromNow(14, 16),
    venueName: "Northfield Innovation Hall",
    venueAddress: "12 Campus Loop, Northfield",
    capacity: 80,
  });
  const buildNight = await upsertEvent({
    collegeId: northfield.id,
    clubId: robotics.id,
    createdById: roboticsPresident.id,
    title: "Build Night: Line-Following Robots (Demo)",
    slug: "build-night-line-following-robots",
    summary:
      "A hands-on build night for students curious about sensors and simple autonomous robots.",
    description:
      "A fictional build night for local development. Teams assemble a small line-following robot and test it on a tabletop course.",
    status: "PUBLISHED",
    startsAt: daysFromNow(7, 17),
    endsAt: daysFromNow(7, 20),
    venueName: "Northfield Makerspace",
    venueAddress: "2 Workshop Lane, Northfield",
    capacity: 35,
  });
  const debateNight = await upsertEvent({
    collegeId: northfield.id,
    clubId: debate.id,
    createdById: debatePresident.id,
    title: "Open Mic Debate Night (Demo)",
    slug: "open-mic-debate-night",
    summary: "A relaxed evening of short debates and audience questions.",
    description: "A fictional debate night for local development. No prior experience is required.",
    status: "PUBLISHED",
    startsAt: daysFromNow(5, 18),
    endsAt: daysFromNow(5, 20),
    venueName: "Northfield Student Union",
    venueAddress: "4 Union Walk, Northfield",
    capacity: 40,
  });
  const filmNight = await upsertEvent({
    collegeId: northfield.id,
    clubId: film.id,
    createdById: debatePresident.id,
    title: "Film Under the Stars (Demo)",
    slug: "film-under-the-stars",
    summary: "An outdoor screening and a short discussion afterward.",
    description: "A fictional outdoor film night for local development. Bring a blanket.",
    status: "PUBLISHED",
    startsAt: daysFromNow(9, 19),
    endsAt: daysFromNow(9, 22),
    venueName: "Northfield Quad Lawn",
    venueAddress: "1 Quad Lane, Northfield",
    capacity: 120,
  });
  const aiWorkshop = await upsertEvent({
    collegeId: northfield.id,
    clubId: robotics.id,
    createdById: roboticsPresident.id,
    title: "Intro to AI Workshop (Demo)",
    slug: "intro-to-ai-workshop",
    summary: "A hands-on beginner workshop on practical AI tools.",
    description:
      "A fictional draft workshop for local development. The club is still finalizing the room.",
    status: "DRAFT",
    startsAt: daysFromNow(18, 14),
    endsAt: daysFromNow(18, 17),
    venueName: "Northfield Lab 2",
    capacity: 30,
  });
  const careerFair = await upsertEvent({
    collegeId: northfield.id,
    clubId: robotics.id,
    createdById: roboticsPresident.id,
    title: "Northfield Career Fair (Demo)",
    slug: "northfield-career-fair",
    summary: "Meet fictional employers and practice a short introduction.",
    description: "A fictional career fair submitted for college review in local development.",
    status: "PENDING_APPROVAL",
    startsAt: daysFromNow(21, 10),
    endsAt: daysFromNow(21, 17),
    venueName: "Northfield Convention Center",
    capacity: 200,
  });
  const cryptoMeetup = await upsertEvent({
    collegeId: northfield.id,
    clubId: robotics.id,
    createdById: roboticsPresident.id,
    title: "Crypto Meetup (Demo)",
    slug: "crypto-meetup",
    summary: "A fictional event used to demonstrate rejection history.",
    description: "This fictional event was rejected because the safety plan was incomplete.",
    status: "REJECTED",
    startsAt: daysFromNow(30, 17),
    endsAt: daysFromNow(30, 19),
    venueName: "Northfield Seminar Room",
    capacity: 50,
    rejectionReason: "The safety plan was incomplete. Please revise and resubmit.",
  });
  const welcomeBack = await upsertEvent({
    collegeId: northfield.id,
    clubId: film.id,
    createdById: debatePresident.id,
    title: "Northfield Welcome Back Screening (Demo)",
    slug: "welcome-back-screening",
    summary: "A fictional completed event for local development history.",
    description: "A fictional completed screening used to exercise completed-event states.",
    status: "COMPLETED",
    startsAt: daysFromNow(-20, 18),
    endsAt: daysFromNow(-20, 21),
    venueName: "Northfield Auditorium",
    capacity: 150,
  });
  const photoWalk = await upsertEvent({
    collegeId: lakeview.id,
    clubId: photography.id,
    createdById: photoPresident.id,
    title: "Lakeview Photo Walk (Demo)",
    slug: "lakeview-photo-walk",
    summary: "A guided walk around the lake with a short editing session.",
    description:
      "A fictional photo walk for local development. Bring any camera, including a phone.",
    status: "PUBLISHED",
    startsAt: daysFromNow(10, 8),
    endsAt: daysFromNow(10, 12),
    venueName: "Lakeview Lakeside Trail",
    venueAddress: "8 Lakeside Drive, Lakeview",
    capacity: 25,
  });
  const cancelledConcert = await upsertEvent({
    collegeId: lakeview.id,
    clubId: photography.id,
    createdById: photoPresident.id,
    title: "Lakeview Sunset Concert (Demo)",
    slug: "lakeview-sunset-concert",
    summary: "A fictional cancelled event used to exercise cancellation states.",
    description:
      "This fictional concert was cancelled because the outdoor venue became unavailable.",
    status: "CANCELLED",
    startsAt: daysFromNow(8, 18),
    endsAt: daysFromNow(8, 21),
    venueName: "Lakeview Amphitheatre",
    capacity: 100,
    cancellationReason: "The outdoor venue became unavailable.",
  });

  for (const [event, categorySlugs] of [
    [roboticsExpo, ["academic", "career"]],
    [buildNight, ["academic", "career"]],
    [debateNight, ["academic", "arts-culture"]],
    [filmNight, ["arts-culture", "community"]],
    [aiWorkshop, ["academic"]],
    [careerFair, ["career"]],
    [cryptoMeetup, ["academic"]],
    [welcomeBack, ["arts-culture"]],
    [photoWalk, ["arts-culture", "community"]],
  ] as const) {
    const categories =
      event.collegeId === northfield.id ? northfieldCategories : lakeviewCategories;

    for (const slug of categorySlugs) {
      const category = categories.get(slug);
      if (!category) {
        throw new Error(`Seed category not found: ${slug}`);
      }

      await upsertEventCategory({
        collegeId: event.collegeId,
        eventId: event.id,
        categoryId: category.id,
      });
    }
  }

  for (const registration of [
    {
      collegeId: northfield.id,
      eventId: roboticsExpo.id,
      studentProfileId: isha.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: northfield.id,
      eventId: roboticsExpo.id,
      studentProfileId: dev.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: northfield.id,
      eventId: debateNight.id,
      studentProfileId: isha.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: northfield.id,
      eventId: debateNight.id,
      studentProfileId: nina.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: northfield.id,
      eventId: filmNight.id,
      studentProfileId: isha.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: northfield.id,
      eventId: filmNight.id,
      studentProfileId: nina.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: lakeview.id,
      eventId: photoWalk.id,
      studentProfileId: omar.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: lakeview.id,
      eventId: photoWalk.id,
      studentProfileId: priya.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: lakeview.id,
      eventId: photoWalk.id,
      studentProfileId: lucy.profile.id,
      status: "CONFIRMED" as const,
    },
    {
      collegeId: northfield.id,
      eventId: welcomeBack.id,
      studentProfileId: dev.profile.id,
      status: "ATTENDED" as const,
    },
    {
      collegeId: northfield.id,
      eventId: welcomeBack.id,
      studentProfileId: nina.profile.id,
      status: "NO_SHOW" as const,
    },
    {
      collegeId: lakeview.id,
      eventId: cancelledConcert.id,
      studentProfileId: omar.profile.id,
      status: "CANCELLED" as const,
    },
  ]) {
    await upsertRegistration(registration);
  }

  for (const notification of [
    {
      id: "00000000-0000-4000-8000-000000000101",
      collegeId: northfield.id,
      userId: isha.user.id,
      type: "REGISTRATION_UPDATE" as const,
      title: "Seat confirmed",
      body: `You are registered for ${roboticsExpo.title}. We will remind you before it starts.`,
      actionUrl: `/student/events/${roboticsExpo.id}`,
      createdAt: daysFromNow(-1, 18),
    },
    {
      id: "00000000-0000-4000-8000-000000000102",
      collegeId: northfield.id,
      userId: isha.user.id,
      type: "EVENT_REMINDER" as const,
      title: "Film Under the Stars is coming up",
      body: "Bring a blanket to the Northfield Quad Lawn. Your registration is confirmed.",
      actionUrl: `/student/events/${filmNight.id}`,
      readAt: daysFromNow(-2, 20),
      createdAt: daysFromNow(-2, 19),
    },
    {
      id: "00000000-0000-4000-8000-000000000103",
      collegeId: northfield.id,
      userId: roboticsPresident.id,
      type: "MODERATION_UPDATE" as const,
      title: "Career Fair submitted for review",
      body: "Northfield Career Fair is waiting for a college administrator decision.",
      actionUrl: `/club/events/${careerFair.id}?club=${robotics.id}`,
      createdAt: daysFromNow(-1, 9),
    },
    {
      id: "00000000-0000-4000-8000-000000000104",
      collegeId: northfield.id,
      userId: northfieldAdmin.id,
      type: "MODERATION_UPDATE" as const,
      title: "Event approval waiting",
      body: "One event submission is ready for your review in the college approval queue.",
      actionUrl: "/college/approvals",
      createdAt: daysFromNow(-1, 8),
    },
  ]) {
    await upsertNotification(notification);
  }

  const counts = await prisma.$transaction([
    prisma.college.count(),
    prisma.user.count(),
    prisma.club.count(),
    prisma.event.count(),
    prisma.eventRegistration.count(),
  ]);

  console.log("Development seed complete (fictional data only).");
  console.log(
    `Colleges: ${counts[0]} | Users: ${counts[1]} | Clubs: ${counts[2]} | Events: ${counts[3]} | Registrations: ${counts[4]}`,
  );
  console.log(
    `Demo accounts: ${platformAdmin.email}, ${northfieldAdmin.email}, ${lakeviewAdmin.email}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
