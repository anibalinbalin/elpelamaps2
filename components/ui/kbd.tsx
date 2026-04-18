import { forwardRef } from "react";

type KbdProps = React.HTMLAttributes<HTMLElement>;

export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd(
  { className = "", ...rest },
  ref,
) {
  return (
    <kbd
      ref={ref}
      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-mono bg-[var(--color-ink-inset)] border border-[var(--color-hairline-dark)] rounded-[4px] text-white/72 ${className}`}
      {...rest}
    />
  );
});
