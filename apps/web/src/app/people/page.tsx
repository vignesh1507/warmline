import Link from "next/link";
import { formatDay } from "@warmline/shared";
import { Nav } from "@/components/Nav";
import { Button, Card, EmptyState, inputClass, labelClass, SectionTitle } from "@/components/ui";
import { WarmthMeter } from "@/components/Warmth";
import { createPerson, markTalked } from "@/lib/actions/people";
import { getPeopleList } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await requireUser();
  const people = await getPeopleList(user.id);

  return (
    <>
      <Nav active="people" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">People</h1>
          <p className="mt-1 text-sm muted">
            Coldest first. Warmth is worked out from when you last spoke and how often you&apos;d like to
            — not from anything anyone else can see.
          </p>
        </div>

        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium">Add someone</summary>
          <form action={createPerson} className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelClass} htmlFor="name">
                Name
              </label>
              <input id="name" name="name" className={inputClass} required />
            </div>
            <div>
              <label className={labelClass} htmlFor="relationship">
                Who they are
              </label>
              <input id="relationship" name="relationship" className={inputClass} placeholder="cousin" />
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
                defaultValue={user.defaultCadenceDays}
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" size="sm">
                Add
              </Button>
            </div>
          </form>
        </details>

        {people.length === 0 ? (
          <EmptyState title="Nobody here yet">
            People appear as you add events about them, or add someone directly above.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {people.map((person) => {
              const next = person.events[0];
              async function talked() {
                "use server";
                await markTalked(person.id);
              }
              return (
                <Card as="li" key={person.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href={`/people/${person.id}`} className="font-medium hover:text-ember">
                        {person.name}
                      </Link>
                      {person.relationship ? (
                        <span className="text-sm muted"> · {person.relationship}</span>
                      ) : null}
                      <WarmthMeter
                        lastContactAt={person.lastContactAt}
                        cadenceDays={person.cadenceDays}
                        className="mt-2 max-w-xs"
                      />
                      <p className="mt-1.5 text-xs muted">
                        {person._count.notes} note{person._count.notes === 1 ? "" : "s"}
                        {" · "}
                        {person._count.events} event{person._count.events === 1 ? "" : "s"}
                        {person.openLoops.length ? ` · ${person.openLoops.length} open loop` : ""}
                        {next ? ` · next: ${next.title}, ${formatDay(next.date)}` : ""}
                      </p>
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
        )}
      </main>
    </>
  );
}
