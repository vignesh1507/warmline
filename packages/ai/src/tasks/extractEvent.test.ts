import { describe, expect, it } from "vitest";
import type { GemmaProvider } from "../provider";
import { extractEvent, needsFollowUp } from "./extractEvent";

/** A stand-in for Gemma, so the contract can be tested without a model. */
function provider(...answers: string[]): GemmaProvider {
  let call = 0;
  return {
    name: "test",
    model: "test-model",
    complete: async () => answers[Math.min(call++, answers.length - 1)]!,
  };
}

const TODAY = new Date(2026, 9, 29);

describe("extractEvent", () => {
  it("reads a clean answer", async () => {
    const { data } = await extractEvent(
      provider(
        JSON.stringify({
          person: { name: "Maya", relationship: "friend" },
          title: "Maya's birthday",
          date: "2027-06-14",
          recurring: true,
          kind: "CELEBRATION",
          details: [],
          noteWorthy: ["likes gardening"],
          confidence: 0.9,
          missing: [],
          followUpQuestion: null,
        }),
      ),
      { message: "Maya's birthday is on 14 June. She likes gardening.", today: TODAY },
    );

    expect(data.person.name).toBe("Maya");
    expect(data.recurring).toBe(true);
    expect(data.noteWorthy).toEqual(["likes gardening"]);
    expect(needsFollowUp(data)).toBe(false);
  });

  it("asks a question instead of inventing a date", async () => {
    const { data } = await extractEvent(
      provider(
        JSON.stringify({
          person: { name: "Priya" },
          title: "Coffee with Priya",
          date: null,
          dateText: "sometime soon",
          recurring: false,
          kind: "CATCHUP",
          details: [],
          noteWorthy: [],
          confidence: 0.6,
          missing: [],
          followUpQuestion: null,
        }),
      ),
      { message: "coffee with Priya sometime soon", today: TODAY },
    );

    // The model left both the date and the question blank; the contract fills in
    // the question rather than letting a dateless event through.
    expect(data.date).toBeNull();
    expect(data.missing).toContain("date");
    expect(data.followUpQuestion).toBeTruthy();
    expect(needsFollowUp(data)).toBe(true);
  });

  it("copes with a fenced, loosely typed answer", async () => {
    const { data, attempts } = await extractEvent(
      provider(
        '```json\n{"person":{"name":"Arjun"},"title":"Housewarming","date":"2026-11-04","recurring":"no","kind":"celebration","details":"parents coming","noteWorthy":null,"confidence":"85","missing":null}\n```',
      ),
      { message: "Arjun's housewarming on the 4th, parents coming", today: TODAY },
    );

    expect(attempts).toBe(1);
    expect(data.recurring).toBe(false);
    expect(data.kind).toBe("CELEBRATION");
    expect(data.details).toEqual(["parents coming"]);
    expect(data.confidence).toBeCloseTo(0.85);
  });

  it("retries once with the error, then succeeds", async () => {
    const { data, attempts } = await extractEvent(
      provider(
        "I think that's probably in June?",
        JSON.stringify({
          person: { name: "Sam" },
          title: "Reach out to Sam",
          date: "2026-11-07",
          recurring: false,
          kind: "APOLOGY",
          details: [],
          noteWorthy: [],
          confidence: 0.7,
          missing: [],
          followUpQuestion: null,
        }),
      ),
      { message: "I should finally message Sam on the 7th", today: TODAY },
    );

    expect(attempts).toBe(2);
    expect(data.title).toBe("Reach out to Sam");
  });

  it("gives up honestly when the model never returns JSON", async () => {
    await expect(
      extractEvent(provider("no", "still no"), { message: "something", today: TODAY }),
    ).rejects.toThrow(/didn't fit the expected shape/);
  });
});

describe("wrapped answers", () => {
  it("unwraps an answer the model put inside a list", async () => {
    const payload = {
      person: { name: "Nisha" },
      title: "Thesis defence",
      date: "2026-12-03",
      recurring: false,
      kind: "MILESTONE",
      details: [],
      noteWorthy: ["loves dark chocolate"],
      confidence: 0.9,
      missing: [],
      followUpQuestion: null,
    };
    const { data, attempts } = await extractEvent(provider(JSON.stringify([payload])), {
      message: "Nisha defends her thesis on 3rd December",
      today: TODAY,
    });
    expect(attempts).toBe(1);
    expect(data.person.name).toBe("Nisha");
  });

  it("unwraps a single-key envelope", async () => {
    const payload = {
      person: { name: "Sam" },
      title: "Call Sam",
      date: "2026-11-07",
      recurring: false,
      kind: "CATCHUP",
      details: [],
      noteWorthy: [],
      confidence: 0.8,
      missing: [],
      followUpQuestion: null,
    };
    const { data } = await extractEvent(provider(JSON.stringify({ result: payload })), {
      message: "call Sam on the 7th",
      today: TODAY,
    });
    expect(data.title).toBe("Call Sam");
  });
});

describe("signal batches", () => {
  it("keeps the good item when another in the batch is malformed", async () => {
    const { extractSignals } = await import("./extractSignals");
    const reply = JSON.stringify({
      events: [
        { personName: "", title: "", quote: "", confidence: 0.1 },
        {
          personName: "Barathi sir",
          title: "viva",
          date: "2026-10-30",
          dateText: "tomorrow",
          recurring: false,
          kind: "OTHER",
          details: [],
          quote: "we have a viva tomorrow with barathi sir",
          confidence: 1,
        },
      ],
      loops: [],
    });
    const { data } = await extractSignals(provider(reply), {
      chatName: "Dinesh",
      messages: [{ id: "m1", isMe: true, text: "we have a viva tomorrow", at: TODAY }],
      today: TODAY,
    });
    expect(data.events).toHaveLength(1);
    expect(data.events[0]!.personName).toBe("Barathi sir");
  });
});
