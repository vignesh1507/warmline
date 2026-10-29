import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function PrivacyPage() {
  return (
    <>
      <Nav active="settings" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">What Warmline stores, and why</h1>
          <p className="mt-1 text-sm muted">
            This app holds information about people who never agreed to be in it. That deserves
            saying plainly.
          </p>
        </div>

        <Card className="space-y-4 text-sm">
          <Section title="What is saved">
            <ul className="list-disc space-y-1 pl-5">
              <li>People you add: a name, optionally how you&apos;d describe them, and how often you&apos;d like to be in touch.</li>
              <li>Events: a title, a date, and whatever details you typed.</li>
              <li>Notes: only what you wrote or explicitly kept.</li>
              <li>Open loops: promises you recorded or accepted from a chat.</li>
              <li>Suggestions: so you can see what was proposed and which of your notes it came from.</li>
            </ul>
          </Section>

          <Section title="Where it lives">
            <p>
              In your own Postgres database. There is no Warmline server, no analytics, no third party
              with a copy. Anyone with the passcode and the URL can read it, so treat the passcode as
              the key to all of it.
            </p>
          </Section>

          <Section title="What leaves the machine">
            <p>
              Only when you ask for ideas, and only to the Gemma provider you configured: the person&apos;s
              name, the event, and your notes about them, trimmed and with emails, links and long
              numbers stripped. Settings lists this exactly. Choose Ollama and nothing leaves at all.
            </p>
          </Section>

          <Section title="WhatsApp">
            <ul className="list-disc space-y-1 pl-5">
              <li>Nothing is read until you tick a specific chat in Settings.</li>
              <li>Messages are read to work out what to propose, then dropped — they are never written to the database. A short quote is kept only if you turn that on.</li>
              <li>Proposals wait in the Inbox. Nothing becomes real data without you accepting it.</li>
              <li>Warmline cannot send messages, reply, or react. The bridge has no code that can, and a test fails the build if someone adds it.</li>
              <li>The link itself is a WhatsApp session on your machine, in the bridge&apos;s folder. Deleting that folder unlinks it, as does removing the device in WhatsApp.</li>
            </ul>
          </Section>

          <Section title="Getting it back, or getting rid of it">
            <p>
              Export everything as JSON, delete any single person, event or note, or wipe the whole
              database — all from{" "}
              <Link href="/settings" className="underline hover:text-ember">
                Settings
              </Link>
              . Deleting a person removes their notes, events and loops with them.
            </p>
          </Section>

          <Section title="What it will not do">
            <p>
              It will not claim to know someone&apos;s preferences when you never recorded them. Every
              suggestion either cites the notes it came from or says it is a guess, and anything that
              cites a note which does not exist is dropped before you see it.
            </p>
          </Section>
        </Card>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 font-semibold">{title}</h2>
      <div className="space-y-1 muted">{children}</div>
    </section>
  );
}
