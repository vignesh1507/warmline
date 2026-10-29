import { warmth as computeWarmth, type WarmthBand } from "@warmline/shared";

const BAND_STYLE: Record<WarmthBand, { bar: string; text: string; word: string }> = {
  WARM: { bar: "bg-warm", text: "text-warm", word: "warm" },
  COOLING: { bar: "bg-cooling", text: "text-cooling", word: "cooling" },
  COLD: { bar: "bg-cold", text: "text-cold", word: "cold" },
};

export function WarmthMeter({
  lastContactAt,
  cadenceDays,
  showLabel = true,
  className = "",
}: {
  lastContactAt: Date | null;
  cadenceDays: number;
  showLabel?: boolean;
  className?: string;
}) {
  const w = computeWarmth(lastContactAt, cadenceDays);
  const style = BAND_STYLE[w.band];
  return (
    <div className={className}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--line)]"
        role="meter"
        aria-valuenow={w.score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Warmth: ${style.word}, last contact ${w.label}`}
      >
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.max(w.score, 2)}%` }} />
      </div>
      {showLabel ? (
        <p className="mt-1.5 text-xs muted">
          <span className={`font-medium ${style.text}`}>{style.word}</span>
          {" · "}
          {w.label}
          {w.days !== null ? ` · you aim for every ${cadenceDays} days` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function WarmthDot({ lastContactAt, cadenceDays }: { lastContactAt: Date | null; cadenceDays: number }) {
  const w = computeWarmth(lastContactAt, cadenceDays);
  const style = BAND_STYLE[w.band];
  return (
    <span
      className={`inline-block size-2.5 shrink-0 rounded-full ${style.bar}`}
      title={`${style.word} · ${w.label}`}
      aria-label={`${style.word}, last contact ${w.label}`}
    />
  );
}
