"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { InboxType, LoopDirection } from "@warmline/db";
import { acceptInboxItem, rejectInboxItem } from "@/lib/actions/inbox";
import { Button, Card, IdeaBadge, inputClass, labelClass, Pill } from "@/components/ui";

export type InboxView = {
  id: string;
  type: InboxType;
  chatName: string | null;
  snippet: string | null;
  createdAt: string;
  payload: Record<string, unknown>;
};

/**
 * A proposal from a monitored chat. It is editable before it is accepted, and
 * accepting is the only way it becomes real data.
 */
export function InboxCard({ item }: { item: InboxView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEvent = item.type === "EVENT";
  const [title, setTitle] = useState(String(item.payload.title ?? item.payload.text ?? ""));
  const [personName, setPersonName] = useState(String(item.payload.personName ?? ""));
  const [date, setDate] = useState(String(item.payload.date ?? item.payload.dueDate ?? ""));
  const [direction, setDirection] = useState<LoopDirection>(
    (item.payload.direction as LoopDirection) ?? "I_OWE",
  );

  const confidence = Number(item.payload.confidence ?? 0);
  const dateText = item.payload.dateText ?? item.payload.dueText;

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptInboxItem(item.id, {
        personName,
        title,
        text: title,
        date,
        dueAt: date,
        direction,
      });
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function reject() {
    startTransition(async () => {
      await rejectInboxItem(item.id);
      router.refresh();
    });
  }

  return (
    <Card as="li">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill tone={isEvent ? "ember" : "warn"}>{isEvent ? "Event" : "Open loop"}</Pill>
          <span className="text-xs muted">
            from {item.chatName ?? "a chat"} {" · "} {item.createdAt}
            {confidence ? ` · ${Math.round(confidence * 100)}% sure` : ""}
          </span>
        </div>
        <IdeaBadge>Not saved yet</IdeaBadge>
      </div>

      {item.snippet ? (
        <p className="mb-3 border-l-2 border-[var(--line)] pl-2 text-sm italic muted">
          &ldquo;{item.snippet}&rdquo;
        </p>
      ) : (
        <p className="mb-3 text-xs muted">
          The message itself wasn&apos;t kept — turn on quotes in Settings if you want to see them here.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label className={labelClass}>{isEvent ? "What is it" : "What was promised"}</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Who</label>
          <input className={inputClass} value={personName} onChange={(e) => setPersonName(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{isEvent ? "Date" : "Due (optional)"}</label>
          <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!isEvent ? (
          <div>
            <label className={labelClass}>Direction</label>
            <select
              className={inputClass}
              value={direction}
              onChange={(e) => setDirection(e.target.value as LoopDirection)}
            >
              <option value="I_OWE">I owe them</option>
              <option value="THEY_OWE">They owe me</option>
            </select>
          </div>
        ) : null}
      </div>

      {dateText && !date ? (
        <p className="mt-2 text-xs muted">
          They said &ldquo;{String(dateText)}&rdquo; — pick a date to accept this.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={accept} disabled={pending || (isEvent && !date) || !title.trim()}>
          {pending ? "Saving…" : "Accept"}
        </Button>
        <Button size="sm" variant="quiet" onClick={reject} disabled={pending}>
          No thanks
        </Button>
      </div>
    </Card>
  );
}
