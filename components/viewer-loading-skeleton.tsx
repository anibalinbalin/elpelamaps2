"use client";

export function ViewerLoadingSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="relative h-dvh w-dvw overflow-hidden bg-[#111820]"
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-18%,rgba(255,244,215,0.12),rgba(255,244,215,0.04)_22%,rgba(255,244,215,0)_52%),linear-gradient(180deg,rgba(88,145,212,0.14)_0%,rgba(126,182,226,0.08)_18%,rgba(161,206,234,0.03)_34%,rgba(192,219,233,0)_62%)]" />
      <div className="absolute inset-x-[-10%] top-[42%] bottom-[10%] bg-[radial-gradient(ellipse_at_50%_58%,rgba(238,223,191,0.18),rgba(238,223,191,0.07)_36%,rgba(238,223,191,0)_72%)] blur-[56px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,252,246,0.03)_0%,rgba(255,252,246,0.008)_16%,rgba(255,252,246,0)_34%,rgba(13,18,24,0.04)_100%)]" />
    </div>
  );
}
