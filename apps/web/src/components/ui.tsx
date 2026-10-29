import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  return <Tag className={`card p-4 sm:p-5 ${className}`}>{children}</Tag>;
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide uppercase muted">{children}</h2>
      {hint ? <span className="text-xs muted">{hint}</span> : null}
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ember" | "warn" | "cool";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-[var(--line)] text-[var(--ink-soft)]",
    ember: "bg-ember-soft text-ember",
    warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    cool: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/**
 * Every AI-generated block wears one of these. The requirement is that ideas
 * never read as facts, and the cheapest way to honour it is to say so, visibly,
 * every single time.
 */
export function IdeaBadge({ children = "Ideas, not facts" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--line)] px-2 py-0.5 text-[11px] font-medium muted">
      <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true" fill="currentColor">
        <path d="M8 1.5a4.5 4.5 0 0 0-2.6 8.17c.3.21.47.55.47.92v.41h4.26v-.41c0-.37.17-.71.47-.92A4.5 4.5 0 0 0 8 1.5Zm-2.13 11v.5c0 .83.67 1.5 1.5 1.5h1.26c.83 0 1.5-.67 1.5-1.5v-.5H5.87Z" />
      </svg>
      {children}
    </span>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line)] p-6 text-center">
      <p className="font-medium">{title}</p>
      {children ? <p className="mt-1 text-sm muted">{children}</p> : null}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "quiet";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed";
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  const variants = {
    primary: "bg-ember text-white hover:bg-[#c04a25]",
    ghost: "border border-[var(--line)] hover:bg-[var(--line)]/50",
    quiet: "muted hover:text-[var(--ink)]",
    danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950",
  };
  return (
    <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export const inputClass =
  "w-full rounded-lg border border-[var(--line)] bg-[var(--paper)] px-3 py-2 text-sm outline-none focus:border-ember focus:ring-2 focus:ring-ember/20";

export const labelClass = "block text-xs font-medium muted mb-1";
