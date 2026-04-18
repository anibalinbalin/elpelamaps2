import { forwardRef } from "react";

type PanelVariant = "default" | "thin" | "inset" | "solid";

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: PanelVariant;
  as?: "div" | "section" | "aside" | "header" | "nav";
};

const variantClasses: Record<PanelVariant, string> = {
  default:
    "bg-[var(--color-surface-glass)] backdrop-blur-[24px] shadow-[var(--shadow-glass)] rounded-[var(--radius-xl)] p-1",
  thin:
    "bg-[var(--color-surface-glass)] backdrop-blur-[24px] shadow-[var(--shadow-glass)] rounded-[var(--radius-xl)] p-1",
  inset:
    "bg-[var(--color-ink-inset)] border border-[var(--color-hairline-dark)] rounded-[var(--radius-md)]",
  solid:
    "bg-[var(--color-ink-pane)] border border-[var(--color-hairline-dark)] rounded-[var(--radius-xl)]",
};

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { variant = "default", as = "div", className = "", ...rest },
  ref,
) {
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={`${variantClasses[variant]} text-white ${className}`}
      {...rest}
    />
  );
});
