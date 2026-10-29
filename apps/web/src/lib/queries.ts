import { prisma } from "@warmline/db";
import { addDays, byCoolest, daysSince, startOfDay } from "@warmline/shared";

const personSelect = {
  id: true,
  name: true,
  relationship: true,
  cadenceDays: true,
  lastContactAt: true,
} as const;

export async function getHomeData(userId: string) {
  const now = new Date();
  const today = startOfDay(now);

  const [dueReminders, upcoming, awaitingFollowUp, people, loops, pendingInbox] = await Promise.all([
    prisma.reminder.findMany({
      where: { dueAt: { lte: now }, dismissedAt: null, event: { userId, date: { gte: addDays(today, -1) } } },
      include: { event: { include: { person: { select: personSelect } } } },
      orderBy: { dueAt: "asc" },
      take: 10,
    }),
    prisma.event.findMany({
      where: { userId, date: { gte: today } },
      include: { person: { select: personSelect } },
      orderBy: { date: "asc" },
      take: 25,
    }),
    prisma.event.findMany({
      where: { userId, date: { lt: today, gte: addDays(today, -30) }, followedUpAt: null },
      include: { person: { select: personSelect } },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.person.findMany({ where: { userId }, select: personSelect }),
    prisma.openLoop.findMany({
      where: { userId, status: "OPEN" },
      include: { person: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.inboxItem.count({ where: { userId, status: "PENDING" } }),
  ]);

  return {
    dueReminders,
    upcoming,
    awaitingFollowUp,
    // Coldest first, and only those actually worth a nudge.
    cooling: byCoolest(people, now).filter((p) => p.warmth.band !== "WARM").slice(0, 5),
    peopleCount: people.length,
    loops: loops.filter((loop) => loopNeedsAttention(loop, now)),
    openLoopCount: loops.length,
    pendingInbox,
  };
}

/** Due when its date has passed, or when an undated promise has been sitting too long. */
export function loopNeedsAttention(
  loop: { dueAt: Date | null; createdAt: Date; nudgeAfterDays: number },
  now: Date = new Date(),
): boolean {
  if (loop.dueAt) return loop.dueAt <= now;
  return (daysSince(loop.createdAt, now) ?? 0) >= loop.nudgeAfterDays;
}

export async function getEventDetail(userId: string, eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, userId },
    include: {
      person: {
        select: {
          ...personSelect,
          notes: { orderBy: { createdAt: "desc" } },
        },
      },
      notes: { orderBy: { createdAt: "desc" } },
      reminders: { orderBy: { offsetDays: "desc" } },
      suggestions: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getPeopleList(userId: string) {
  const people = await prisma.person.findMany({
    where: { userId },
    include: {
      _count: { select: { notes: true, events: true } },
      events: {
        where: { date: { gte: startOfDay(new Date()) } },
        orderBy: { date: "asc" },
        take: 1,
        select: { id: true, title: true, date: true },
      },
      openLoops: { where: { status: "OPEN" }, select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  return byCoolest(people);
}

export async function getPersonDetail(userId: string, personId: string) {
  return prisma.person.findFirst({
    where: { id: personId, userId },
    include: {
      notes: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { date: "asc" } },
      openLoops: { orderBy: { createdAt: "desc" } },
    },
  });
}

export async function getInbox(userId: string) {
  const [pending, decided] = await Promise.all([
    prisma.inboxItem.findMany({
      where: { userId, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.inboxItem.findMany({
      where: { userId, status: { in: ["ACCEPTED", "REJECTED"] } },
      orderBy: { decidedAt: "desc" },
      take: 10,
    }),
  ]);
  return { pending, decided };
}

export async function getSettingsData(userId: string) {
  const [chats, bridge, counts] = await Promise.all([
    prisma.whatsappChat.findMany({ where: { userId }, orderBy: [{ monitored: "desc" }, { name: "asc" }] }),
    prisma.bridgeState.findUnique({ where: { id: "singleton" } }),
    Promise.all([
      prisma.person.count({ where: { userId } }),
      prisma.event.count({ where: { userId } }),
      prisma.note.count({ where: { userId } }),
      prisma.openLoop.count({ where: { userId } }),
      prisma.inboxItem.count({ where: { userId } }),
    ]).then(([people, events, notes, loops, inbox]) => ({ people, events, notes, loops, inbox })),
  ]);
  return { chats, bridge, counts };
}
