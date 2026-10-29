import Link from "next/link";
import { prisma, SINGLE_USER_ID } from "@warmline/db";

async function badgeCounts() {
  const now = new Date();
  const [due, pending] = await Promise.all([
    prisma.reminder.count({
      where: { dueAt: { lte: now }, dismissedAt: null, event: { userId: SINGLE_USER_ID } },
    }),
    prisma.inboxItem.count({ where: { userId: SINGLE_USER_ID, status: "PENDING" } }),
  ]);
  return { due, pending };
}

export async function Nav({ active }: { active: "home" | "people" | "inbox" | "settings" }) {
  const { due, pending } = await badgeCounts();

  const items = [
    { key: "home", href: "/", label: "Home", badge: due },
    { key: "people", href: "/people", label: "People", badge: 0 },
    { key: "inbox", href: "/inbox", label: "Inbox", badge: pending },
    { key: "settings", href: "/settings", label: "Settings", badge: 0 },
  ] as const;

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
        <Link href="/" className="mr-auto flex items-center gap-2 font-semibold tracking-tight">
          <Flame />
          Warmline
        </Link>
        <nav className="flex items-center gap-0.5">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active === item.key ? "page" : undefined}
              className={`relative rounded-lg px-2.5 py-1.5 text-sm transition ${
                active === item.key ? "bg-ember-soft font-medium text-ember" : "muted hover:text-[var(--ink)]"
              }`}
            >
              {item.label}
              {item.badge > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-ember text-[10px] font-semibold text-white">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function Flame() {
  return (
    <svg viewBox="0 0 20 20" className="size-5 text-ember" aria-hidden="true" fill="currentColor">
      <path d="M10 1.5c.3 2.1-.6 3.3-1.8 4.4C6.7 7.2 5 8.6 5 11.4A5 5 0 0 0 15 12c0-2.2-1-3.6-2.1-5-.9-1.1-1.6-2.3-1.3-3.9-.5.4-1.1 1-1.6 1.8-.3-1.2-.3-2.3 0-3.4Z" />
    </svg>
  );
}
