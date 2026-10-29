import { addNote, skipFollowUp } from "@/lib/actions/notes";
import { Button, inputClass } from "@/components/ui";

/**
 * After an event, the app asks once. The user decides what, if anything, is
 * worth keeping — and what they write here is what later suggestions stand on.
 */
export function FollowUpForm({
  eventId,
  personId,
  personName,
  compact = false,
}: {
  eventId: string;
  personId: string;
  personName: string;
  compact?: boolean;
}) {
  async function skip() {
    "use server";
    await skipFollowUp(eventId);
  }

  return (
    <div className={compact ? "" : "mt-2"}>
      <form action={addNote} className="space-y-2">
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="personId" value={personId} />
        <input type="hidden" name="kind" value="POST_EVENT" />
        <textarea
          name="body"
          rows={2}
          className={inputClass}
          placeholder={`How did it go? Anything you learned about ${personName}?`}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            Save note
          </Button>
          <span className="text-xs muted">Only what you type is saved.</span>
        </div>
      </form>
      <form action={skip} className="mt-1.5">
        <Button type="submit" variant="quiet" size="sm">
          Nothing to add
        </Button>
      </form>
    </div>
  );
}
