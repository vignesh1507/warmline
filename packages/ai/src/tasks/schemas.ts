import { z } from "zod";

export const EVENT_KINDS = [
  "CELEBRATION",
  "MILESTONE",
  "CATCHUP",
  "APOLOGY",
  "CONDOLENCE",
  "FAVOUR",
  "OTHER",
] as const;

export const eventKind = z.preprocess(
  (v) => (typeof v === "string" ? v.toUpperCase().trim() : v),
  z.enum(EVENT_KINDS).catch("OTHER"),
);

/** Small models answer with a bare string where a list was asked for. Accept both. */
export const strArray = z.preprocess((v) => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === "string" && x.trim()).map((x) => (x as string).trim());
  if (typeof v === "string") return v.trim() ? [v.trim()] : [];
  return [];
}, z.array(z.string()));

export const nullableDate = z.preprocess((v) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(null|unknown|unclear|n\/?a)$/i.test(t)) return null;
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(t);
  return m ? m[0] : null;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

export const nullableText = z.preprocess((v) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && !/^(null|none|n\/?a)$/i.test(t) ? t : null;
}, z.string().nullable());

export const confidence = z.preprocess((v) => {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || Number.isNaN(n)) return 0.5;
  return n > 1 ? n / 100 : n;
}, z.number().min(0).max(1).catch(0.5));

export const boolish = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(true|yes|y|1)$/i.test(v.trim());
  return false;
}, z.boolean());

/** An idea that must either cite notes or admit it is a guess. */
export const idea = z.object({
  text: z.string().min(1),
  groundedOn: strArray.default([]),
  assumption: nullableText.default(null),
});
export type Idea = z.infer<typeof idea>;

export const ideaArray = z.preprocess((v) => {
  if (!Array.isArray(v)) return [];
  return v.map((item) => (typeof item === "string" ? { text: item } : item));
}, z.array(idea));
