import Link from "next/link";
import { agendaBucket, formatDay, formatRelative } from "@warmline/shared";
import { Card, EmptyState, Pill, SectionTitle, Button } from "@/components/ui";
import { WarmthDot, WarmthMeter } from "@/components/Warmth";
import { dismissReminder } from "@/lib/actions/events";
import { closeLoop } from "@/lib/actions/loops";
import { markTalked } from "@/lib/actions/people";
import { EVENT_KIND_LABEL } from "@/lib/types";
import type { getHomeData } from "@/lib/queries";

type Home = Awaited<ReturnType<typeof getHomeData>>;

export function DueReminders({ reminders }: { reminders: Home["dueReminders"] }) {
  if (reminders.length === 0) return null;
  return (
    <section>
      <SectionTitle hint="your chosen timing">Reminders</SectionTitle>
      <ul className="space-y-2">
        {reminders.map((reminder) => {
          async function dismiss() {
            "use server";
            await dismissReminder(reminder.id);
          }
          return (
            <Card as="li" key={reminder.id} className="border-ember/40 bg-ember-soft/50">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {reminder.event.title}
                    <span className="muted font-normal">
                      {" · "}
                      {formatRelative(reminder.event.date)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm muted">
                    {reminder.offsetDays === 0
                      ? "Today"
                      : `${reminder.offsetDays} day${reminder.offsetDays === 1 ? "" : "s"} ahead`}
                    {" · "}
                    {formatDay(reminder.event.date)}
                    {reminder.event.details.length ? ` · ${reminder.event.details[0]}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link href={`/events/${reminder.eventId}`}>
                    <Button size="sm">How to prepare</Button>
                  </Link>
                  <form action={dismiss}>
                    <Button type="submit" variant="quiet" size="sm">
                      Dismiss
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          );
        })}
      </ul>
    </section>
  );
}

export function Agenda({ events }: { events: Home["upcoming"] }) {
  if (events.length === 0) {
    return (
      <section>
        <SectionTitle>Coming up</SectionTitle>
        <EmptyState title="Nothing in the diary yet">
          Type something above — &ldquo;Maya&apos;s birthday is on 14 June&rdquo; is enough to start.
        </EmptyState>
      </section>
    );
  }

  const groups: { key: string; label: string; items: Home["upcoming"] }[] = [
    { key: "TODAY", label: "Today", items: [] },
    { key: "THIS_WEEK", label: "This week", items: [] },
    { key: "LATER", label: "Later", items: [] },
  ];
  for (const event of events) {
    const bucket = agendaBucket(event.date);
    const group = groups.find((g) => g.key === bucket) ?? groups[2]!;
    group.items.push(event);
  }

  return (
    <section>
      <SectionTitle hint={`${events.length} saved`}>Coming up</SectionTitle>
      <div className="space-y-4">
        {groups
          .filter((group) => group.items.length > 0)
          .map((group) => (
            <div key={group.key}>
              <p className="mb-1.5 text-xs font-medium muted">{group.label}</p>
              <ul className="space-y-2">
                {group.items.map((event) => (
                  <Card as="li" key={event.id}>
                    <Link href={`/events/${event.id}`} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          <WarmthDot
                            lastContactAt={event.person.lastContactAt}
                            cadenceDays={event.person.cadenceDays}
                          />
                          <span className="truncate">{event.title}</span>
                        </p>
                        <p className="mt-0.5 text-sm muted">
                          {event.person.name}
                          {" · "}
                          {formatDay(event.date)}
                          {" · "}
                          {formatRelative(event.date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Pill tone={event.kind === "CELEBRATION" ? "ember" : "neutral"}>
                          {EVENT_KIND_LABEL[event.kind]}
                        </Pill>
                        {event.recurring ? <span className="text-[11px] muted">every year</span> : null}
                      </div>
                    </Link>
                  </Card>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </section>
  );
}

export function CoolingOff({ cooling }: { cooling: Home["cooling"] }) {
  if (cooling.length === 0) return null;
  return (
    <section>
      <SectionTitle hint="warmth fades on its own">Cooling off</SectionTitle>
      <ul className="space-y-2">
        {cooling.map((person) => {
          async function talked() {
            "use server";
            await markTalked(person.id);
          }
          return (
            <Card as="li" key={person.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/people/${person.id}`} className="font-medium hover:text-ember">
                    {person.name}
                  </Link>
                  <WarmthMeter
                    lastContactAt={person.lastContactAt}
                    cadenceDays={person.cadenceDays}
                    className="mt-2 max-w-xs"
                  />
                </div>
                <form action={talked}>
                  <Button type="submit" variant="ghost" size="sm">
                    We talked
                  </Button>
                </form>
              </div>
            </Card>
          );
        })}
      </ul>
    </section>
  );
}

export function OpenLoops({ loops, total }: { loops: Home["loops"]; total: number }) {
  if (total === 0) return null;
  return (
    <section>
      <SectionTitle hint={`${total} open in total`}>Open loops</SectionTitle>
      {loops.length === 0 ? (
        <p className="text-sm muted">Nothing needs chasing today.</p>
      ) : (
        <ul className="space-y-2">
          {loops.map((loop) => {
            async function done() {
              "use server";
              await closeLoop(loop.id, "DONE");
            }
            async function drop() {
              "use server";
              await closeLoop(loop.id, "DROPPED");
            }
            return (
              <Card as="li" key={loop.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{loop.text}</p>
                    <p className="mt-0.5 text-sm muted">
                      <Pill tone={loop.direction === "I_OWE" ? "warn" : "cool"}>
                        {loop.direction === "I_OWE" ? "you owe" : "they owe"}
                      </Pill>{" "}
                      {loop.person.name}
                      {loop.dueAt ? ` · due ${formatRelative(loop.dueAt)}` : " · no date"}
                    </p>
                    {loop.quote ? (
                      <p className="mt-1 border-l-2 border-[var(--line)] pl-2 text-xs italic muted">
                        &ldquo;{loop.quote}&rdquo;
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <form action={done}>
                      <Button type="submit" size="sm" variant="ghost">
                        Done
                      </Button>
                    </form>
                    <form action={drop}>
                      <Button type="submit" size="sm" variant="quiet">
                        Let it go
                      </Button>
                    </form>
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </section>
  );
}
