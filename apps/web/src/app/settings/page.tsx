import Link from "next/link";
import { formatRelative } from "@warmline/shared";
import { Nav } from "@/components/Nav";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Button, Card, inputClass, labelClass, Pill, SectionTitle } from "@/components/ui";
import { signOut } from "@/lib/actions/auth";
import { forgetWhatsappData, setChatMonitored, updateSettings, wipeEverything } from "@/lib/actions/settings";
import { aiConfig, aiDisclosure, aiReady } from "@/lib/ai";
import { getSettingsData } from "@/lib/queries";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const BRIDGE_STATUS_LABEL: Record<string, string> = {
  DISCONNECTED: "Not connected",
  QR_PENDING: "Waiting for you to scan",
  AUTHENTICATING: "Linking…",
  CONNECTED: "Connected",
  ERROR: "Something went wrong",
};

export default async function SettingsPage() {
  const user = await requireUser();
  const { chats, bridge, counts } = await getSettingsData(user.id);
  const cfg = aiConfig();
  const disclosure = aiDisclosure(cfg);
  const ready = aiReady(cfg);
  const monitoredCount = chats.filter((c) => c.monitored).length;

  async function wipe() {
    "use server";
    await wipeEverything();
  }
  async function forgetWhatsapp() {
    "use server";
    await forgetWhatsappData();
  }

  return (
    <>
      <Nav active="settings" />
      <AutoRefresh enabled={bridge?.status === "QR_PENDING" || bridge?.status === "AUTHENTICATING"} />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>

        <section>
          <SectionTitle>Reminders</SectionTitle>
          <Card>
            <form action={updateSettings} className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="offsets">
                  Remind me this many days before (comma separated)
                </label>
                <input
                  id="offsets"
                  name="offsets"
                  className={inputClass}
                  defaultValue={user.reminderOffsetsDefault.join(", ")}
                />
                <p className="mt-1 text-xs muted">Applies to new events. Each event can differ.</p>
              </div>
              <div>
                <label className={labelClass} htmlFor="cadenceDays">
                  Default catch-up rhythm (days)
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
                <p className="mt-1 text-xs muted">How fast warmth fades for someone new.</p>
              </div>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  name="storeSnippets"
                  defaultChecked={user.storeSnippets}
                  className="mt-0.5 size-4 accent-[var(--color-ember)]"
                />
                <span>
                  Keep a short quote with things found in WhatsApp
                  <span className="block text-xs muted">
                    Off by default. With this off, Warmline keeps only what it understood, never the
                    message itself.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  name="monitorAllChats"
                  defaultChecked={user.monitorAllChats}
                  className="mt-0.5 size-4 accent-[var(--color-ember)]"
                />
                <span>
                  Watch every chat
                  <span className="block text-xs muted">
                    Reads every conversation on this account, including new ones, without ticking them
                    individually. The people in those chats have not agreed to this — it is on you to
                    decide that is fine.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  name="autoAcceptEvents"
                  defaultChecked={user.autoAcceptEvents}
                  className="mt-0.5 size-4 accent-[var(--color-ember)]"
                />
                <span>
                  File events automatically, by person
                  <span className="block text-xs muted">
                    Skips the Inbox: anything found is saved straight away under the person&apos;s name.
                    Quicker, but a misread message becomes real data without you seeing it first.
                  </span>
                </span>
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm">
                  Save settings
                </Button>
              </div>
            </form>
          </Card>
        </section>

        <section>
          <SectionTitle hint={monitoredCount ? `${monitoredCount} chat${monitoredCount === 1 ? "" : "s"} watched` : "nothing watched"}>
            WhatsApp
          </SectionTitle>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">
                  {BRIDGE_STATUS_LABEL[bridge?.status ?? "DISCONNECTED"]}
                  {bridge?.fake ? " (fixture mode)" : ""}
                </p>
                <p className="text-xs muted">
                  {bridge?.lastSeenAt ? `bridge last spoke ${formatRelative(bridge.lastSeenAt)}` : "bridge has never connected"}
                  {bridge?.phoneHint ? ` · ${bridge.phoneHint}` : ""}
                </p>
              </div>
              <Pill tone={bridge?.status === "CONNECTED" ? "ember" : "neutral"}>
                {bridge?.status ?? "DISCONNECTED"}
              </Pill>
            </div>

            {bridge?.lastError ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/50 dark:text-red-300">
                {bridge.lastError}
              </p>
            ) : null}

            {bridge?.status === "QR_PENDING" && bridge.qrDataUrl ? (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-[var(--line)] p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={bridge.qrDataUrl} alt="WhatsApp linking QR code" className="size-56 rounded bg-white p-2" />
                <p className="text-center text-xs muted">
                  WhatsApp → Settings → Linked devices → Link a device. This page updates itself.
                </p>
              </div>
            ) : null}

            <p className="mt-3 text-xs muted">
              The bridge runs separately (<code>pnpm bridge</code>) and only ever reads. It cannot send
              messages — there is no code in it that can.
            </p>

            {chats.length === 0 ? (
              <p className="mt-3 text-sm muted">
                No chats yet. Start the bridge and they&apos;ll appear here for you to choose from.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-[var(--line)]">
                {chats.map((chat) => {
                  async function toggle() {
                    "use server";
                    await setChatMonitored(chat.chatId, !chat.monitored);
                  }
                  return (
                    <li key={chat.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {chat.name}
                          {chat.isGroup ? <span className="muted"> (group)</span> : null}
                        </p>
                        <p className="text-xs muted">
                          {chat.monitored
                            ? `watched since ${chat.consentAt ? formatRelative(chat.consentAt) : "recently"}`
                            : "not watched"}
                        </p>
                      </div>
                      <form action={toggle}>
                        <Button type="submit" size="sm" variant={chat.monitored ? "ghost" : "primary"}>
                          {chat.monitored ? "Stop watching" : "Watch this chat"}
                        </Button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}

            <form action={forgetWhatsapp} className="mt-3 border-t border-[var(--line)] pt-3">
              <Button type="submit" variant="danger" size="sm">
                Forget all WhatsApp data
              </Button>
              <span className="ml-2 text-xs muted">Chats, inbox items and the link state.</span>
            </form>
          </Card>
        </section>

        <section>
          <SectionTitle>Gemma</SectionTitle>
          <Card>
            <p className="text-sm">
              <span className="font-medium">{disclosure.label}</span> {" · "} {disclosure.model}
              {!ready ? <span className="text-red-600 dark:text-red-400"> · no API key set</span> : null}
            </p>
            <p className="mt-1 text-xs muted">Requests go to {disclosure.where}.</p>
            {disclosure.caution ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                {disclosure.caution}
              </p>
            ) : null}
            <div className="mt-3 text-xs muted">
              <p className="font-medium">What gets sent, when you ask for ideas:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                <li>the person&apos;s name and how you described them</li>
                <li>the event title, date and details you typed</li>
                <li>up to 24 of your most recent notes about them, trimmed</li>
                <li>nothing else — emails, links and long numbers are stripped first</li>
              </ul>
              <p className="mt-2">Change the provider with AI_PROVIDER in your .env.</p>
            </div>
          </Card>
        </section>

        <section>
          <SectionTitle>Your data</SectionTitle>
          <Card>
            <p className="text-sm">
              {counts.people} people {" · "} {counts.events} events {" · "} {counts.notes} notes{" "}
              {" · "} {counts.loops} loops {" · "} {counts.inbox} inbox items
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <a href="/api/export" download>
                <Button variant="ghost" size="sm">
                  Export everything (JSON)
                </Button>
              </a>
              <Link href="/privacy">
                <Button variant="quiet" size="sm">
                  What Warmline stores, and why
                </Button>
              </Link>
            </div>

            <details className="mt-4 border-t border-[var(--line)] pt-3">
              <summary className="cursor-pointer text-sm text-red-700 dark:text-red-400">
                Delete everything
              </summary>
              <p className="mt-2 text-xs muted">
                Every person, event, note, loop and inbox item is removed from the database. This
                cannot be undone, and no copy is kept.
              </p>
              <form action={wipe} className="mt-2">
                <Button type="submit" variant="danger" size="sm">
                  Yes, delete all of it
                </Button>
              </form>
            </details>
          </Card>
        </section>

        <section>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </section>
      </main>
    </>
  );
}
