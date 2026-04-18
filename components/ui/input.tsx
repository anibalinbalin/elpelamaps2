import { forwardRef } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  mono?: boolean;
  invalid?: boolean;
};

const base =
  "w-full h-9 px-3 text-[13px] bg-white/[0.04] border rounded-[var(--radius-md)] text-white placeholder:text-white/40 outline-none transition-colors duration-150 focus:bg-white/10 focus:border-white/25";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono = false, invalid = false, className = "", ...rest },
  ref,
) {
  const borderColor = invalid
    ? "border-red-400/50"
    : "border-[var(--color-hairline-dark)]";
  const family = mono ? "font-mono tabular-nums" : "";
  return (
    <input
      ref={ref}
      className={`${base} ${borderColor} ${family} ${className}`}
      {...rest}
    />
  );
});

type SliderProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  value: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider(
  { className = "", ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="range"
      className={`h-1.5 w-full appearance-none bg-white/10 rounded-full outline-none accent-white ${className}`}
      {...rest}
    />
  );
});
