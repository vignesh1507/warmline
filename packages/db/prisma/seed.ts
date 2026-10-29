/**
 * Seed data: one user and a handful of people, so the app has something to show
 * on a fresh database. Dates are relative to today, so the demo never goes stale.
 *
 * Safe to run repeatedly: it wipes the seeded user and rebuilds.
 */
import { addDays, reminderDueAt, startOfDay, toISODate } from "@warmline/shared";
import { prisma } from "../src/client";
import { SINGLE_USER_ID } from "../src/constants";

const USER_ID = SINGLE_USER_ID;

function daysOut(n: number): Date {
  return startOfDay(addDays(new Date(), n));
}

/** A fixed month/day in the next 12 months, for birthdays. */
function anniversary(month: number, day: number): Date {
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), month - 1, day);
  return startOfDay(thisYear >= startOfDay(now) ? thisYear : new Date(now.getFullYear() + 1, month - 1, day));
}

async function main() {
  console.log("Seeding Warmline…");

  // Cascades clear people, events, notes, loops, inbox and chats with it.
  await prisma.user.deleteMany({ where: { id: USER_ID } });

  const user = await prisma.user.create({
    data: {
      id: USER_ID,
      label: "me",
      reminderOffsetsDefault: [7, 1],
      defaultCadenceDays: 30,
    },
  });

  const maya = await prisma.person.create({
    data: {
      userId: user.id,
      name: "Maya",
      relationship: "friend from university",
      cadenceDays: 30,
      lastContactAt: daysOut(-12),
    },
  });

  const arjun = await prisma.person.create({
    data: {
      userId: user.id,
      name: "Arjun",
      relationship: "brother",
      cadenceDays: 14,
      lastContactAt: daysOut(-3),
    },
  });

  const priya = await prisma.person.create({
    data: {
      userId: user.id,
      name: "Priya",
      relationship: "colleague, now a friend",
      cadenceDays: 45,
      lastContactAt: daysOut(-20),
    },
  });

  // Deliberately cold: gives the warmth meter and the rehearsal card something to do.
  const sam = await prisma.person.create({
    data: {
      userId: user.id,
      name: "Sam",
      relationship: "old friend, drifted",
      cadenceDays: 60,
      lastContactAt: daysOut(-240),
    },
  });

  await prisma.note.createMany({
    data: [
      {
        userId: user.id,
        personId: maya.id,
        body: "Maya has taken over her balcony with tomatoes and chillies. Kept asking about soil.",
        kind: "PREFERENCE",
        createdAt: daysOut(-400),
      },
      {
        userId: user.id,
        personId: maya.id,
        body: "She hates surprises. Tell her the plan in advance, even for nice things.",
        kind: "PREFERENCE",
        createdAt: daysOut(-300),
      },
      {
        userId: user.id,
        personId: maya.id,
        body: "Last birthday we did a long walk and bad coffee. She said it was the best one in years.",
        kind: "MEMORY",
        createdAt: anniversary(6, 15),
      },
      {
        userId: user.id,
        personId: arjun.id,
        body: "Moved into the new flat in Indiranagar. No proper coffee setup yet, drinks filter coffee daily.",
        kind: "PREFERENCE",
        createdAt: daysOut(-20),
      },
      {
        userId: user.id,
        personId: priya.id,
        body: "Doing a part-time design course on weekends. Tired but likes it.",
        kind: "MEMORY",
        createdAt: daysOut(-35),
      },
      {
        userId: user.id,
        personId: sam.id,
        body: "We fell out of touch after I missed his wedding. I still feel bad about it.",
        kind: "MEMORY",
        createdAt: daysOut(-200),
      },
    ],
  });

  const events = [
    {
      personId: maya.id,
      title: "Maya's birthday",
      date: anniversary(6, 14),
      recurring: true,
      kind: "CELEBRATION" as const,
      details: ["She likes gardening"],
      offsets: [7, 1],
    },
    {
      personId: priya.id,
      title: "Coffee with Priya",
      date: daysOut(2),
      recurring: false,
      kind: "CATCHUP" as const,
      details: ["Her pick of cafe", "She finishes work at 6"],
      offsets: [1],
    },
    {
      personId: arjun.id,
      title: "Arjun's housewarming",
      date: daysOut(6),
      recurring: false,
      kind: "CELEBRATION" as const,
      details: ["Saturday evening", "Parents coming too"],
      offsets: [7, 1],
    },
    {
      personId: sam.id,
      title: "Reach out to Sam",
      date: daysOut(9),
      recurring: false,
      kind: "APOLOGY" as const,
      details: ["Long overdue"],
      offsets: [1],
    },
    {
      // Already past, with no follow-up note: the app will ask how it went.
      personId: arjun.id,
      title: "Arjun's work presentation",
      date: daysOut(-3),
      recurring: false,
      kind: "MILESTONE" as const,
      details: ["He was nervous about it"],
      offsets: [1],
    },
  ];

  for (const e of events) {
    const event = await prisma.event.create({
      data: {
        userId: user.id,
        personId: e.personId,
        title: e.title,
        date: e.date,
        recurring: e.recurring,
        kind: e.kind,
        details: e.details,
        source: "MANUAL",
      },
    });
    await prisma.reminder.createMany({
      data: e.offsets.map((offsetDays) => ({
        eventId: event.id,
        offsetDays,
        dueAt: reminderDueAt(e.date, offsetDays),
      })),
    });
    console.log(`  event: ${e.title} (${toISODate(e.date)})`);
  }

  await prisma.openLoop.createMany({
    data: [
      {
        userId: user.id,
        personId: maya.id,
        text: "Send Maya the tomato seed guide",
        direction: "I_OWE",
        dueAt: daysOut(-2),
        quote: "I'll dig out that seed guide and send it over",
        createdAt: daysOut(-9),
      },
      {
        userId: user.id,
        personId: arjun.id,
        text: "Arjun still has my drill",
        direction: "THEY_OWE",
        dueAt: null,
        createdAt: daysOut(-30),
      },
    ],
  });

  await prisma.whatsappChat.createMany({
    data: [
      { userId: user.id, chatId: "demo-maya@c.us", name: "Maya", lastMessageAt: daysOut(-12) },
      { userId: user.id, chatId: "demo-arjun@c.us", name: "Arjun", lastMessageAt: daysOut(-3) },
      { userId: user.id, chatId: "demo-flatmates@g.us", name: "Flat 302", isGroup: true, lastMessageAt: daysOut(-1) },
    ],
  });

  await prisma.bridgeState.upsert({
    where: { id: "singleton" },
    update: { status: "DISCONNECTED", qrDataUrl: null, lastError: null },
    create: { id: "singleton", status: "DISCONNECTED" },
  });

  const counts = {
    people: await prisma.person.count(),
    events: await prisma.event.count(),
    notes: await prisma.note.count(),
    reminders: await prisma.reminder.count(),
    openLoops: await prisma.openLoop.count(),
  };
  console.log("Done:", counts);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
