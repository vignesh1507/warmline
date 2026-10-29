import Link from "next/link";
import { notFound } from "next/navigation";
import { daysSince, formatDay, formatRelative, toISODate, daysUntil } from "@warmline/shared";
import { Nav } from "@/components/Nav";
import { FollowUpForm } from "@/components/FollowUpForm";
import { SuggestionPanel, type NoteRef, type SuggestionView } from "@/components/SuggestionPanel";
import { Button, Card, inputClass, labelClass, Pill, SectionTitle } from "@/components/ui";
import { WarmthMeter } from "@/components/Warmth";
import { deleteEvent, markRemindersRead, updateEvent } from "@/lib/actions/events";
import { addNote, deleteNote } from "@/lib/actions/notes";
import { getEventDetail } from "@/lib/queries";
import { requireUser } from "@/lib/session";
import { EVENT_KIND_LABEL, SENSITIVE_KINDS } from "@/lib/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ECHO_MIN_AGE_DAYS = 60;

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const event = await getEventDetail(user.id, id);
  if (!event) notFound();

  // Opening the event is reading the reminder.
  await markRemindersRead(event.id);

  const notes: NoteRef[] = event.person.notes.map((n) => ({
    id: n.id,
    body: n.body,
    createdAt: toISODate(n.createdAt),
  }));
  const suggestions: SuggestionView[] = event.suggestions.map((s) => ({
    id: s.id,
    kind: s.kind,
    status: s.status,
    content: (s.content ?? {}) as Record<string, unknown>,
    groundedNoteIds: s.groundedNoteIds,
    assumptions: s.assumptions,
    model: s.model,
  }));
  const hasOlderNotes = event.person.notes.some((n) => (daysSince(n.createdAt) ?? 0) >= ECHO_MIN_AGE_DAYS);
  const isPast = daysUntil(event.date) < 0;

  async function remove() {
    "use server";
    await deleteEvent(id);
    redirect("/");
  }

  return (
    <>
      <Nav active="home" />
      <main className="mx-auto max-w-3xl space-y-7 px-4 py-6">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{event.title}</h1>
              <p className="mt-1 text-sm muted">
                <Link href={`/people/${event.person.id}`} className="hover:text-ember">
                  {event.person.name}
                </Link>
                {event.person.relationship ? ` (${event.person.relationship})` : ""}
                {" · "}
                {formatDay(event.date)}
                {" · "}
                {formatRelative(event.date)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Pill tone={SENSITIVE_KINDS.includes(event.kind) ? "warn" : "neutral"}>
                {EVENT_KIND_LABEL[event.kind]}
              </Pill>
              {event.recurring ? <span className="text-[11px] muted">every year</span> : null}
            </div>
          </div>

          <WarmthMeter
            lastContactAt={event.person.lastContactAt}
            cadenceDays={event.person.cadenceDays}
            className="mt-3 max-w-sm"
          />
        </header>

        {event.details.length > 0 ? (
          <section>
            <SectionTitle>What you told me</SectionTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {event.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <SectionTitle hint={event.reminders.length ? undefined : "none set"}>Reminders</SectionTitle>
          {event.reminders.length ? (
            <ul className="flex flex-wrap gap-2">
              {event.reminders.map((reminder) => (
                <li key={reminder.id} className="rounded-full border border-[var(--line)] px-3 py-1 text-xs">
                  {reminder.offsetDays === 0 ? "On the day" : `${reminder.offsetDays} day${reminder.offsetDays === 1 ? "" : "s"} before`}
                  <span className="muted">
                    {" · "}
                    {formatDay(reminder.dueAt)}
                    {reminder.dismissedAt ? " · dismissed" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm muted">No reminders for this one.</p>
          )}
        </section>

        <SuggestionPanel
          eventId={event.id}
          suggestions={suggestions}
          notes={notes}
          sensitive={SENSITIVE_KINDS.includes(event.kind)}
          hasOlderNotes={hasOlderNotes}
        />

        {isPast && !event.followedUpAt ? (
          <section>
            <SectionTitle>How did it go?</SectionTitle>
            <Card>
              <FollowUpForm
                eventId={event.id}
                personId={event.personId}
                personName={event.person.name}
                compact
              />
            </Card>
          </section>
        ) : null}

        <section>
          <SectionTitle hint={`${event.person.notes.length} about ${event.person.name}`}>Notes</SectionTitle>
          <form action={addNote} className="mb-3 space-y-2">
            <input type="hidden" name="personId" value={event.personId} />
            <input type="hidden" name="eventId" value={event.id} />
            <textarea
              name="body"
              rows={2}
              className={inputClass}
              placeholder={`Something worth remembering about ${event.person.name}`}
            />
            <div className="flex items-center gap-2">
              <select name="kind" className={`${inputClass} w-auto`} defaultValue="PREFERENCE">
                <option value="PREFERENCE">A preference</option>
                <option value="MEMORY">A memory</option>
                <option value="IDEA">An idea</option>
                <option value="POST_EVENT">How it went</option>
              </select>
              <Button type="submit" size="sm">
                Add note
              </Button>
            </div>
          </form>

          <ul className="space-y-2">
            {event.person.notes.map((note) => {
              async function remove() {
                "use server";
                await deleteNote(note.id);
              }
              return (
                <Card as="li" key={note.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm">{note.body}</p>
                      <p className="mt-1 text-xs muted">
                        {note.kind.toLowerCase().replace("_", " ")} {" · "} {toISODate(note.createdAt)}
                        {note.source === "WHATSAPP" ? " · from WhatsApp" : ""}
                      </p>
                    </div>
                    <form action={remove}>
                      <button type="submit" className="shrink-0 text-xs muted hover:text-ember">
                        delete
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })}
          </ul>
        </section>

        <section>
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium">Edit or delete this event</summary>
            <form action={updateEvent} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={event.id} />
              <div>
                <label className={labelClass} htmlFor="title">
                  Title
                </label>
                <input id="title" name="title" className={inputClass} defaultValue={event.title} />
              </div>
              <div>
                <label className={labelClass} htmlFor="date">
                  Date
                </label>
                <input id="date" name="date" type="date" className={inputClass} defaultValue={toISODate(event.date)} />
              </div>
              <div>
                <label className={labelClass} htmlFor="kind">
                  Kind
                </label>
                <select id="kind" name="kind" className={inputClass} defaultValue={event.kind}>
                  {Object.entries(EVENT_KIND_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="offsets">
                  Remind me (days before, comma separated)
                </label>
                <input
                  id="offsets"
                  name="offsets"
                  className={inputClass}
                  defaultValue={event.reminders.map((r) => r.offsetDays).join(", ")}
                  placeholder="7, 1"
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="details">
                  Details (one per line)
                </label>
                <textarea
                  id="details"
                  name="details"
                  rows={3}
                  className={inputClass}
                  defaultValue={event.details.join("\n")}
                />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  name="recurring"
                  defaultChecked={event.recurring}
                  className="size-4 accent-[var(--color-ember)]"
                />
                Happens every year
              </label>
              <div className="sm:col-span-2">
                <Button type="submit">Save changes</Button>
              </div>
            </form>

            <form action={remove} className="mt-4 border-t border-[var(--line)] pt-3">
              <Button type="submit" variant="danger" size="sm">
                Delete this event
              </Button>
              <span className="ml-2 text-xs muted">Its reminders and suggestions go too. Notes stay with the person.</span>
            </form>
          </details>
        </section>
      </main>
    </>
  );
}
