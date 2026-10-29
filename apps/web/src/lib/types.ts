import type { EventKind } from "@warmline/db";

/**
 * What the review card holds: Gemma's reading of the message, after the user has
 * had a chance to correct every field. Nothing is written until this is submitted.
 */
export type ReviewDraft = {
  personId: string | null;
  personName: string;
  relationship: string | null;
  title: string;
  /** yyyy-mm-dd, local. Empty string means "still unknown". */
  date: string;
  recurring: boolean;
  kind: EventKind;
  details: string[];
  /** Durable facts about the person, saved as notes if the user keeps them. */
  notes: string[];
  reminderOffsets: number[];
};

export type ProposeResult =
  | {
      ok: true;
      draft: ReviewDraft;
      followUpQuestion: string | null;
      confidence: number;
      dateText: string | null;
      model: string;
      matchedExistingPerson: boolean;
    }
  | { ok: false; error: string };

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  CELEBRATION: "Celebration",
  MILESTONE: "Milestone",
  CATCHUP: "Catch-up",
  APOLOGY: "Apology",
  CONDOLENCE: "Condolence",
  FAVOUR: "Favour",
  OTHER: "Other",
};

/** Kinds where a rehearsal is offered without being asked for. */
export const SENSITIVE_KINDS: EventKind[] = ["APOLOGY", "CONDOLENCE", "FAVOUR"];
