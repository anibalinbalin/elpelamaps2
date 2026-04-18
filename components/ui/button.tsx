import { forwardRef } from "react";

type ButtonVariant = "primary" | "ghost" | "danger";
type ButtonSize = "sm" | "md";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 outline-none focus-visible:ring-1 focus-visible:ring-white/25 disabled:opacity-50 disabled:pointer-events-none";

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[12px] rounded-[var(--radius-md)]",
  md: "h-10 px-4 text-[13px] rounded-[var(--radius-md)]",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-white/12 text-white hover:bg-white/[0.18] active:bg-white/[0.22]",
  ghost:
    "bg-transparent text-white/70 hover:bg-white/10 hover:text-white",
  danger:
    "bg-transparent text-white/70 hover:bg-white/10 hover:text-white",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "ghost", size = "md", className = "", type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
});
