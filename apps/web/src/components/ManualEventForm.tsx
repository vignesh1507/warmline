import { createEventFromForm } from "@/lib/actions/events";
import { Button, inputClass, labelClass } from "@/components/ui";
import { EVENT_KIND_LABEL } from "@/lib/types";

/**
 * The form half of "add by chat or form". Also the fallback when Gemma is not
 * configured — the app has to stay usable without a model.
 */
export function ManualEventForm({
  people,
  defaultOffsets,
}: {
  people: { id: string; name: string }[];
  defaultOffsets: number[];
}) {
  return (
    <details className="card p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-medium">Or fill it in yourself</summary>
      <form action={createEventFromForm} className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="personId">
            Who
          </label>
          <select id="personId" name="personId" className={inputClass} defaultValue="">
            <option value="">Someone new…</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="personName">
            …or a new name
          </label>
          <input id="personName" name="personName" className={inputClass} placeholder="Nisha" />
        </div>
        <div>
          <label className={labelClass} htmlFor="manual-title">
            What is it
          </label>
          <input id="manual-title" name="title" className={inputClass} placeholder="Birthday" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="manual-date">
            Date
          </label>
          <input id="manual-date" name="date" type="date" className={inputClass} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="manual-kind">
            Kind
          </label>
          <select id="manual-kind" name="kind" className={inputClass} defaultValue="CELEBRATION">
            {Object.entries(EVENT_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="manual-offsets">
            Remind me (days before)
          </label>
          <input
            id="manual-offsets"
            name="offsets"
            className={inputClass}
            defaultValue={defaultOffsets.join(", ")}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="manual-details">
            Anything worth remembering (one per line)
          </label>
          <textarea id="manual-details" name="details" rows={2} className={inputClass} />
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="recurring" className="size-4 accent-[var(--color-ember)]" />
          Happens every year
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" size="sm">
            Save event
          </Button>
        </div>
      </form>
    </details>
  );
}
