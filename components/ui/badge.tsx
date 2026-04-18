import { forwardRef } from "react";

type BadgeTone = "neutral" | "emerald" | "amber" | "red" | "cyan";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

const tones: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--color-ink-inset)] text-white/72 border-[var(--color-hairline-dark)]",
  emerald: "bg-emerald-500/12 text-emerald-300 border-emerald-500/25",
  amber: "bg-amber-500/12 text-amber-200 border-amber-500/25",
  red: "bg-red-500/12 text-red-300 border-red-500/25",
  cyan: "bg-cyan-500/12 text-cyan-300 border-cyan-500/25",
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { tone = "neutral", className = "", ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={`inline-flex items-center gap-1.5 h-6 px-2 text-[11px] font-medium uppercase tracking-[0.04em] border rounded-[var(--radius-md)] ${tones[tone]} ${className}`}
      {...rest}
    />
  );
});
