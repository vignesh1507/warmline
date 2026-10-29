import Link from "next/link";
import { formatDay } from "@warmline/shared";
import { Nav } from "@/components/Nav";
import { ChatComposer } from "@/components/ChatComposer";
import { ManualEventForm } from "@/components/ManualEventForm";
import { Agenda, CoolingOff, DueReminders, OpenLoops } from "@/components/HomeLists";
import { FollowUpForm } from "@/components/FollowUpForm";
import { Card, SectionTitle } from "@/components/ui";
import { rollRecurringEvents } from "@/lib/actions/events";
import { getHomeData } from "@/lib/queries";
import { prisma } from "@warmline/db";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  // Birthdays roll themselves forward; no cron, no stale agenda.
  await rollRecurringEvents(user.id);
  const home = await getHomeData(user.id);
  const people = await prisma.person.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <Nav active="home" />
      <main className="mx-auto max-w-3xl space-y-7 px-4 py-6">
        <DueReminders reminders={home.dueReminders} />

        <ChatComposer />

        <ManualEventForm people={people} defaultOffsets={user.reminderOffsetsDefault} />

        {home.pendingInbox > 0 ? (
          <Link
            href="/inbox"
            className="block rounded-[var(--radius-card)] border border-ember/30 bg-ember-soft/40 px-4 py-3 text-sm"
          >
            <span className="font-medium text-ember">
              {home.pendingInbox} thing{home.pendingInbox === 1 ? "" : "s"} from WhatsApp waiting
            </span>
            <span className="muted"> — nothing is saved until you accept it.</span>
          </Link>
        ) : null}

        {home.awaitingFollowUp.length > 0 ? (
          <section>
            <SectionTitle hint="only if you want to">How did it go?</SectionTitle>
            <ul className="space-y-2">
              {home.awaitingFollowUp.map((event) => (
                <Card as="li" key={event.id}>
                  <p className="font-medium">
                    {event.title}
                    <span className="font-normal muted">
                      {" · "}
                      {formatDay(event.date)}
                    </span>
                  </p>
                  <FollowUpForm
                    eventId={event.id}
                    personId={event.personId}
                    personName={event.person.name}
                  />
                </Card>
              ))}
            </ul>
          </section>
        ) : null}

        <Agenda events={home.upcoming} />
        <OpenLoops loops={home.loops} total={home.openLoopCount} />
        <CoolingOff cooling={home.cooling} />

        <footer className="border-t border-[var(--line)] pt-4 text-xs muted">
          {home.peopleCount} {home.peopleCount === 1 ? "person" : "people"} saved, privately.{" "}
          <Link href="/privacy" className="underline hover:text-ember">
            What Warmline stores
          </Link>
        </footer>
      </main>
    </>
  );
}
