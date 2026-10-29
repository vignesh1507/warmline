"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { EventKind } from "@warmline/db";
import { proposeEvent } from "@/lib/actions/chat";
import { saveReviewedEvent } from "@/lib/actions/events";
import { Button, IdeaBadge, inputClass, labelClass } from "@/components/ui";
import { EVENT_KIND_LABEL, type ProposeResult, type ReviewDraft } from "@/lib/types";

const EXAMPLES = [
  "Maya's birthday is on 14 June. She likes gardening.",
  "Dinner with Priya next Thursday, she picks the place",
  "Arjun's housewarming in two weeks, parents coming",
];

/**
 * Add by chat. Gemma proposes; the user corrects; only then is anything saved.
 * The review step is not a formality — every field below is editable, and the
 * save button is disabled until there is a date.
 */
export function ChatComposer() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<ProposeResult | null>(null);
  const [draft, setDraft] = useState<ReviewDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  function submit(text: string) {
    setError(null);
    startTransition(async () => {
      const result = await proposeEvent(text);
      setProposal(result);
      if (result.ok) setDraft(result.draft);
      else setError(result.error);
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    const result = await saveReviewedEvent(draft, "CHAT");
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage("");
    setProposal(null);
    setDraft(null);
    router.push(`/events/${result.data!.eventId}`);
  }

  return (
    <section className="card p-4 sm:p-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (message.trim()) submit(message);
        }}
      >
        <label className={labelClass} htmlFor="composer">
          Tell me something worth remembering
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="composer"
            className={inputClass}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Maya&apos;s birthday is on 14 June. She likes gardening."
            autoComplete="off"
          />
          <Button type="submit" disabled={pending || !message.trim()} className="sm:w-28">
            {pending ? "Reading…" : "Read it"}
          </Button>
        </div>
      </form>

      {!proposal && !pending ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setMessage(example);
                submit(example);
              }}
              className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs muted transition hover:border-ember hover:text-ember"
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {proposal?.ok && draft ? (
        <div className="mt-4 rounded-[var(--radius-card)] border border-ember/30 bg-ember-soft/40 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Here&apos;s what I understood</h3>
              <p className="text-xs muted">
                Check it before saving — {Math.round(proposal.confidence * 100)}% sure, from{" "}
                {proposal.model}
                {proposal.matchedExistingPerson ? " · matched someone you already have" : ""}
              </p>
            </div>
            <IdeaBadge>Nothing saved yet</IdeaBadge>
          </div>

          {proposal.followUpQuestion ? (
            <p className="mb-3 rounded-lg bg-[var(--paper-2)] px-3 py-2 text-sm">
              <span className="font-medium">One thing: </span>
              {proposal.followUpQuestion}
              {proposal.dateText ? <span className="muted"> (you said &ldquo;{proposal.dateText}&rdquo;)</span> : null}
            </p>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Person">
              <input
                className={inputClass}
                value={draft.personName}
                onChange={(e) => setDraft({ ...draft, personName: e.target.value, personId: null })}
              />
            </Field>
            <Field label="What is it">
              <input
                className={inputClass}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </Field>
            <Field label="Date">
              <input
                type="date"
                className={inputClass}
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              />
            </Field>
            <Field label="Kind">
              <select
                className={inputClass}
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value as EventKind })}
              >
                {Object.entries(EVENT_KIND_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.recurring}
              onChange={(e) => setDraft({ ...draft, recurring: e.target.checked })}
              className="size-4 accent-[var(--color-ember)]"
            />
            Happens every year
          </label>

          {draft.details.length > 0 ? (
            <Field label="Details" className="mt-3">
              <textarea
                className={inputClass}
                rows={Math.min(draft.details.length + 1, 4)}
                value={draft.details.join("\n")}
                onChange={(e) => setDraft({ ...draft, details: e.target.value.split("\n") })}
              />
            </Field>
          ) : null}

          {draft.notes.length > 0 ? (
            <div className="mt-3">
              <p className={labelClass}>Save about {draft.personName || "them"}</p>
              <ul className="space-y-1.5">
                {draft.notes.map((note, index) => (
                  <li key={`${note}-${index}`} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked
                      onChange={() =>
                        setDraft({ ...draft, notes: draft.notes.filter((_, i) => i !== index) })
                      }
                      className="mt-0.5 size-4 accent-[var(--color-ember)]"
                      aria-label={`Keep note: ${note}`}
                    />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs muted">
                These become notes about them. Untick anything you&apos;d rather not keep.
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={save} disabled={saving || !draft.date}>
              {saving ? "Saving…" : "Save it"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setProposal(null);
                setDraft(null);
              }}
            >
              Discard
            </Button>
            {!draft.date ? <span className="text-xs muted">A date is needed before this can be saved.</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className={labelClass}>{label}</span>
      {children}
    </div>
  );
}
