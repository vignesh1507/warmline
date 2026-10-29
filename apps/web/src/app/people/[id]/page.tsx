import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatDay, formatRelative, toISODate } from "@warmline/shared";
import { Nav } from "@/components/Nav";
import { Button, Card, EmptyState, inputClass, labelClass, Pill, SectionTitle } from "@/components/ui";
import { WarmthMeter } from "@/components/Warmth";
import { addLoop, closeLoop, deleteLoop, reopenLoop } from "@/lib/actions/loops";
import { addNote, deleteNote } from "@/lib/actions/notes";
import { deletePerson, markTalked, updatePerson } from "@/lib/actions/people";
import { getPersonDetail } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const person = await getPersonDetail(user.id, id);
  if (!person) notFound();

  const openLoops = person.openLoops.filter((l) => l.status === "OPEN");
  const closedLoops = person.openLoops.filter((l) => l.status !== "OPEN");

  async function talked() {
    "use server";
    await markTalked(id);
  }
  async function remove() {
    "use server";
    await deletePerson(id);
    redirect("/people");
  }

  return (
    <>
      <Nav active="people" />
      <main className="mx-auto max-w-3xl space-y-7 px-4 py-6">
        <header>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{person.name}</h1>
              {person.relationship ? <p className="mt-0.5 text-sm muted">{person.relationship}</p> : null}
            </div>
            <form action={talked}>
              <Button type="submit" variant="ghost" size="sm">
                We talked today
              </Button>
            </form>
          </div>
          <WarmthMeter
            lastContactAt={person.lastContactAt}
            cadenceDays={person.cadenceDays}
            className="mt-3 max-w-sm"
          />
        </header>

        <section>
          <SectionTitle hint={`${person.notes.length}`}>What you know</SectionTitle>
          <form action={addNote} className="mb-3 space-y-2">
            <input type="hidden" name="personId" value={person.id} />
            <textarea name="body" rows={2} className={inputClass} placeholder="Something worth remembering" />
            <div className="flex items-center gap-2">
              <select name="kind" className={`${inputClass} w-auto`} defaultValue="PREFERENCE">
                <option value="PREFERENCE">A preference</option>
                <option value="MEMORY">A memory</option>
                <option value="IDEA">An idea</option>
              </select>
              <Button type="submit" size="sm">
                Add note
              </Button>
            </div>
          </form>

          {person.notes.length === 0 ? (
            <EmptyState title="Nothing saved yet">
              Suggestions are only as good as what&apos;s here — and Warmline won&apos;t invent the rest.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {person.notes.map((note) => {
                async function removeNote() {
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
                        </p>
                      </div>
                      <form action={removeNote}>
                        <button type="submit" className="shrink-0 text-xs muted hover:text-ember">
                          delete
                        </button>
                      </form>
                    </div>
                  </Card>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <SectionTitle>Open loops</SectionTitle>
          <form action={addLoop} className="mb-3 grid gap-2 sm:grid-cols-4">
            <input type="hidden" name="personId" value={person.id} />
            <input name="text" className={`${inputClass} sm:col-span-2`} placeholder="Send her the seed guide" />
            <select name="direction" className={inputClass} defaultValue="I_OWE">
              <option value="I_OWE">I owe them</option>
              <option value="THEY_OWE">They owe me</option>
            </select>
            <div className="flex gap-2">
              <input name="dueAt" type="date" className={inputClass} />
              <Button type="submit" size="sm">
                Add
              </Button>
            </div>
          </form>

          {openLoops.length === 0 ? (
            <p className="text-sm muted">Nothing outstanding.</p>
          ) : (
            <ul className="space-y-2">
              {openLoops.map((loop) => {
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
                      <div>
                        <p className="text-sm font-medium">{loop.text}</p>
                        <p className="mt-0.5 text-xs muted">
                          <Pill tone={loop.direction === "I_OWE" ? "warn" : "cool"}>
                            {loop.direction === "I_OWE" ? "you owe" : "they owe"}
                          </Pill>{" "}
                          {loop.dueAt ? `due ${formatRelative(loop.dueAt)}` : "no date"}
                        </p>
                        {loop.quote ? (
                          <p className="mt-1 border-l-2 border-[var(--line)] pl-2 text-xs italic muted">
                            &ldquo;{loop.quote}&rdquo;
                          </p>
                        ) : null}
                      </div>
                      <div className="flex gap-2">
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

          {closedLoops.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs muted">{closedLoops.length} closed</summary>
              <ul className="mt-2 space-y-1">
                {closedLoops.map((loop) => {
                  async function reopen() {
                    "use server";
                    await reopenLoop(loop.id);
                  }
                  async function forget() {
                    "use server";
                    await deleteLoop(loop.id);
                  }
                  return (
                    <li key={loop.id} className="flex items-center justify-between gap-3 text-xs muted">
                      <span className="line-through">{loop.text}</span>
                      <span className="flex gap-2">
                        <form action={reopen}>
                          <button type="submit" className="hover:text-ember">
                            reopen
                          </button>
                        </form>
                        <form action={forget}>
                          <button type="submit" className="hover:text-ember">
                            delete
                          </button>
                        </form>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </section>

        <section>
          <SectionTitle>Events</SectionTitle>
          {person.events.length === 0 ? (
            <p className="text-sm muted">Nothing in the diary for {person.name}.</p>
          ) : (
            <ul className="space-y-2">
              {person.events.map((event) => (
                <Card as="li" key={event.id}>
                  <Link href={`/events/${event.id}`} className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{event.title}</span>
                    <span className="text-xs muted">
                      {formatDay(event.date)} {" · "} {formatRelative(event.date)}
                    </span>
                  </Link>
                </Card>
              ))}
            </ul>
          )}
        </section>

        <section>
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium">Edit or delete {person.name}</summary>
            <form action={updatePerson} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="id" value={person.id} />
              <div>
                <label className={labelClass} htmlFor="name">
                  Name
                </label>
                <input id="name" name="name" className={inputClass} defaultValue={person.name} />
              </div>
              <div>
                <label className={labelClass} htmlFor="relationship">
                  Who they are
                </label>
                <input
                  id="relationship"
                  name="relationship"
                  className={inputClass}
                  defaultValue={person.relationship ?? ""}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="cadenceDays">
                  Catch up every (days)
                </label>
                <input
                  id="cadenceDays"
                  name="cadenceDays"
                  type="number"
                  min={1}
                  max={365}
                  className={inputClass}
                  defaultValue={person.cadenceDays}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="aliases">
                  Also called (comma separated)
                </label>
                <input
                  id="aliases"
                  name="aliases"
                  className={inputClass}
                  defaultValue={person.aliases.join(", ")}
                  placeholder="Mayu, M"
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit">Save changes</Button>
              </div>
            </form>
            <form action={remove} className="mt-4 border-t border-[var(--line)] pt-3">
              <Button type="submit" variant="danger" size="sm">
                Delete {person.name} and everything about them
              </Button>
            </form>
          </details>
        </section>
      </main>
    </>
  );
}
