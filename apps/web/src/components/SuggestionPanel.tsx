"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { SuggestionKind } from "@warmline/db";
import {
  dismissSuggestion,
  generateEcho,
  generatePrep,
  generateRehearsal,
  keepSuggestion,
} from "@/lib/actions/suggestions";
import { Button, Card, IdeaBadge, SectionTitle } from "@/components/ui";

export type SuggestionView = {
  id: string;
  kind: SuggestionKind;
  status: "NEW" | "KEPT" | "DISMISSED";
  content: Record<string, unknown>;
  groundedNoteIds: string[];
  assumptions: string[];
  model: string;
};

export type NoteRef = { id: string; body: string; createdAt: string };

const GROUPS: { kind: SuggestionKind; title: string; blurb: string }[] = [
  { kind: "GIFT", title: "Gift & activity ideas", blurb: "" },
  { kind: "CHECKLIST", title: "Before the day", blurb: "" },
  { kind: "TOPIC", title: "Worth asking about", blurb: "" },
];

export function SuggestionPanel({
  eventId,
  suggestions,
  notes,
  sensitive,
  hasOlderNotes,
}: {
  eventId: string;
  suggestions: SuggestionView[];
  notes: NoteRef[];
  sensitive: boolean;
  hasOlderNotes: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const noteMap = new Map(notes.map((n) => [n.id, n]));
  const live = suggestions.filter((s) => s.status !== "DISMISSED");
  const byKind = (kind: SuggestionKind) => live.filter((s) => s.kind === kind);

  const prep = [...byKind("GIFT"), ...byKind("CHECKLIST"), ...byKind("TOPIC"), ...byKind("DRAFT")];
  const questions = byKind("QUESTION");
  const echo = byKind("ECHO")[0];
  const rehearsal = byKind("REHEARSAL")[0];
  const draft = byKind("DRAFT")[0];

  function run(
    label: string,
    fn: () => Promise<{ ok: boolean; error?: string; data?: { kept?: number; dropped?: number; found?: boolean } }>,
  ) {
    setBusy(label);
    setMessage(null);
    setNotice(null);
    startTransition(async () => {
      const result = await fn();
      setBusy(null);
      if (!result.ok) {
        setMessage(result.error ?? "That didn't work.");
        return;
      }
      // Say out loud when something was thrown away for citing a note that
      // doesn't exist. Silence would look identical to the model behaving.
      const dropped = result.data?.dropped ?? 0;
      if (dropped > 0) {
        setNotice(
          `${dropped} idea${dropped === 1 ? "" : "s"} dropped for citing notes that don't exist.`,
        );
      } else if (result.data?.found === false) {
        setNotice("No older note was a genuine fit, so there's no echo this time.");
      }
      router.refresh();
    });
  }

  return (
    <section className="space-y-4">
      <SectionTitle hint={prep.length ? `from ${prep[0]!.model}` : undefined}>
        Preparing
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => run("prep", () => generatePrep(eventId))}
          disabled={pending}
          size="sm"
        >
          {busy === "prep" ? "Thinking…" : prep.length ? "Regenerate ideas" : "Suggest how to prepare"}
        </Button>
        {hasOlderNotes ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run("echo", () => generateEcho(eventId))}
          >
            {busy === "echo" ? "Looking back…" : "Find an echo"}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => run("rehearsal", () => generateRehearsal(eventId))}
        >
          {busy === "rehearsal" ? "Rehearsing…" : sensitive ? "Help me start this" : "Rehearse the conversation"}
        </Button>
        <IdeaBadge />
      </div>

      {/* Gemma 4 reasons before it answers, and on AI Studio's free tier that is
          genuinely slow. Saying so beats a spinner that looks broken. */}
      {pending ? <p className="text-xs muted">Gemma usually takes 30 to 50 seconds for this.</p> : null}

      {message ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {message}
        </p>
      ) : null}

      {notice ? <p className="text-xs muted">{notice}</p> : null}

      {echo ? <EchoCard suggestion={echo} noteMap={noteMap} onDismiss={() => run("dismiss", async () => { await dismissSuggestion(echo.id); return { ok: true }; })} /> : null}

      {rehearsal ? (
        <RehearsalCard
          suggestion={rehearsal}
          onDismiss={() => run("dismiss", async () => { await dismissSuggestion(rehearsal.id); return { ok: true }; })}
        />
      ) : null}

      {questions.length > 0 ? (
        <Card className="border-dashed">
          <p className="text-sm font-medium">I don&apos;t know enough yet. Tell me:</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {questions.map((q) => (
              <li key={q.id} className="flex items-start justify-between gap-3">
                <span>{String(q.content.text ?? "")}</span>
                <button
                  type="button"
                  className="shrink-0 text-xs muted hover:text-ember"
                  onClick={() => run("dismiss", async () => { await dismissSuggestion(q.id); return { ok: true }; })}
                >
                  dismiss
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs muted">
            Add a note below and the next round of ideas will be built on it.
          </p>
        </Card>
      ) : null}

      {GROUPS.map((group) => {
        const items = byKind(group.kind);
        if (items.length === 0) return null;
        return (
          <div key={group.kind}>
            <p className="mb-1.5 text-xs font-medium muted">{group.title}</p>
            <ul className="space-y-2">
              {items.map((item) => (
                <IdeaCard
                  key={item.id}
                  suggestion={item}
                  noteMap={noteMap}
                  onKeep={() => run("keep", async () => { await keepSuggestion(item.id); return { ok: true }; })}
                  onDismiss={() => run("dismiss", async () => { await dismissSuggestion(item.id); return { ok: true }; })}
                />
              ))}
            </ul>
          </div>
        );
      })}

      {draft ? <DraftCard suggestion={draft} onDismiss={() => run("dismiss", async () => { await dismissSuggestion(draft.id); return { ok: true }; })} /> : null}
    </section>
  );
}

function Grounding({ suggestion, noteMap }: { suggestion: SuggestionView; noteMap: Map<string, NoteRef> }) {
  const cited = suggestion.groundedNoteIds.map((id) => noteMap.get(id)).filter(Boolean) as NoteRef[];
  if (cited.length === 0) {
    const assumption = suggestion.assumptions[0];
    return (
      <p className="mt-1.5 text-xs muted">
        {assumption ? `A guess — ${assumption}` : "A general suggestion, not based on your notes."}
      </p>
    );
  }
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-xs muted hover:text-ember">
        Based on {cited.length} note{cited.length === 1 ? "" : "s"} you wrote
      </summary>
      <ul className="mt-1.5 space-y-1 border-l-2 border-[var(--line)] pl-2">
        {cited.map((note) => (
          <li key={note.id} className="text-xs muted">
            <span className="font-medium">{note.createdAt}</span> — {note.body}
          </li>
        ))}
      </ul>
    </details>
  );
}

function IdeaCard({
  suggestion,
  noteMap,
  onKeep,
  onDismiss,
}: {
  suggestion: SuggestionView;
  noteMap: Map<string, NoteRef>;
  onKeep: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card as="li" className={suggestion.status === "KEPT" ? "border-ember/40" : ""}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">{String(suggestion.content.text ?? "")}</p>
          <Grounding suggestion={suggestion} noteMap={noteMap} />
        </div>
        <div className="flex shrink-0 gap-1">
          {suggestion.status === "KEPT" ? (
            <span className="text-xs font-medium text-ember">kept</span>
          ) : (
            <>
              <button type="button" onClick={onKeep} className="text-xs muted hover:text-ember" title="Keep as a note">
                keep
              </button>
              <button type="button" onClick={onDismiss} className="text-xs muted hover:text-ember">
                dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function DraftCard({ suggestion, onDismiss }: { suggestion: SuggestionView; onDismiss: () => void }) {
  const [text, setText] = useState(String(suggestion.content.text ?? ""));
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium muted">A message you could send</p>
      <Card>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-lg border border-[var(--line)] bg-[var(--paper)] p-3 text-sm outline-none focus:border-ember"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copied" : "Copy"}
          </Button>
          <button type="button" onClick={onDismiss} className="text-xs muted hover:text-ember">
            dismiss
          </button>
          {/* Deliberate: Warmline never sends anything on your behalf. */}
          <span className="text-xs muted">Warmline won&apos;t send this — copy it and send it yourself.</span>
        </div>
      </Card>
    </div>
  );
}

function EchoCard({
  suggestion,
  noteMap,
  onDismiss,
}: {
  suggestion: SuggestionView;
  noteMap: Map<string, NoteRef>;
  onDismiss: () => void;
}) {
  const noteId = String(suggestion.content.noteId ?? "");
  const note = noteMap.get(noteId);
  return (
    <Card className="border-ember/30 bg-ember-soft/30">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-ember">An echo from your notes</p>
          <p className="mt-1 text-sm">{String(suggestion.content.text ?? "")}</p>
          {note ? (
            <p className="mt-1.5 border-l-2 border-ember/40 pl-2 text-xs muted">
              You wrote on {note.createdAt}: &ldquo;{note.body}&rdquo;
            </p>
          ) : null}
        </div>
        <button type="button" onClick={onDismiss} className="shrink-0 text-xs muted hover:text-ember">
          dismiss
        </button>
      </div>
    </Card>
  );
}

function RehearsalCard({ suggestion, onDismiss }: { suggestion: SuggestionView; onDismiss: () => void }) {
  const feelings = (suggestion.content.feelings as string[]) ?? [];
  const openers = (suggestion.content.openers as { text: string }[]) ?? [];
  const avoid = (suggestion.content.avoid as string[]) ?? [];
  const reminder = String(suggestion.content.reminder ?? "");

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">Before you start</p>
        <button type="button" onClick={onDismiss} className="shrink-0 text-xs muted hover:text-ember">
          dismiss
        </button>
      </div>

      {feelings.length > 0 ? (
        <div className="mt-2">
          <p className="text-xs font-medium muted">They may be feeling</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
            {feelings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {openers.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium muted">Two ways to open</p>
          <ul className="mt-1 space-y-1.5">
            {openers.map((o) => (
              <li key={o.text} className="rounded-lg bg-[var(--paper)] px-3 py-2 text-sm">
                &ldquo;{o.text}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {avoid.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs font-medium muted">Maybe not</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
            {avoid.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {reminder ? <p className="mt-3 text-xs muted">{reminder}</p> : null}
    </Card>
  );
}
