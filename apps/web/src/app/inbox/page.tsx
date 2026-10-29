import Link from "next/link";
import { toISODate } from "@warmline/shared";
import { Nav } from "@/components/Nav";
import { InboxCard, type InboxView } from "@/components/InboxCard";
import { Button, EmptyState, SectionTitle } from "@/components/ui";
import { clearDecidedInbox } from "@/lib/actions/inbox";
import { getInbox } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireUser();
  const { pending, decided } = await getInbox(user.id);

  const items: InboxView[] = pending.map((item) => ({
    id: item.id,
    type: item.type,
    chatName: item.chatName,
    snippet: item.snippet,
    createdAt: toISODate(item.createdAt),
    payload: (item.payload ?? {}) as Record<string, unknown>,
  }));

  async function clear() {
    "use server";
    await clearDecidedInbox();
  }

  return (
    <>
      <Nav active="inbox" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm muted">
            Things Warmline noticed in the chats you chose to monitor. Nothing here is saved until you
            accept it, and you can change any of it first.
          </p>
        </div>

        {items.length === 0 ? (
          <EmptyState title="Nothing waiting">
            Connect WhatsApp in{" "}
            <Link href="/settings" className="underline hover:text-ember">
              Settings
            </Link>{" "}
            and pick which chats to watch — or keep adding things by hand on the home screen.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <InboxCard key={item.id} item={item} />
            ))}
          </ul>
        )}

        {decided.length > 0 ? (
          <section>
            <SectionTitle hint={`${decided.length}`}>Recently decided</SectionTitle>
            <ul className="space-y-1 text-sm muted">
              {decided.map((item) => (
                <li key={item.id}>
                  {item.status === "ACCEPTED" ? "✓" : "✗"}{" "}
                  {String((item.payload as Record<string, unknown>).title ?? (item.payload as Record<string, unknown>).text ?? "item")}
                  {item.chatName ? ` · ${item.chatName}` : ""}
                </li>
              ))}
            </ul>
            <form action={clear} className="mt-2">
              <Button type="submit" variant="quiet" size="sm">
                Clear this list
              </Button>
            </form>
          </section>
        ) : null}
      </main>
    </>
  );
}
