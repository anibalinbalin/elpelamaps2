"use client";

interface ViewerLoadingSkeletonProps {
  overlay?: boolean;
}

export function ViewerLoadingSkeleton({
  overlay = false,
}: ViewerLoadingSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`overflow-hidden bg-[#111820] ${
        overlay ? "absolute inset-0 z-40" : "relative h-screen w-screen"
      }`}
    >
      {/* Atmospheric backdrop — matches the real viewer wash */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-18%,rgba(255,244,215,0.17),rgba(255,244,215,0.06)_24%,rgba(255,244,215,0)_56%),linear-gradient(180deg,rgba(88,145,212,0.18)_0%,rgba(126,182,226,0.12)_18%,rgba(161,206,234,0.06)_34%,rgba(192,219,233,0.02)_52%,rgba(192,219,233,0)_66%),linear-gradient(180deg,rgba(255,235,194,0)_48%,rgba(255,235,194,0.07)_70%,rgba(255,235,194,0.12)_82%,rgba(255,235,194,0.06)_92%,rgba(255,235,194,0)_100%)]" />
      <div className="absolute inset-x-[-9%] top-[42%] bottom-[12%] scale-[1.04] bg-[linear-gradient(180deg,rgba(174,214,245,0)_0%,rgba(174,214,245,0.1)_22%,rgba(201,227,244,0.18)_40%,rgba(229,214,184,0.18)_58%,rgba(229,214,184,0.07)_72%,rgba(229,214,184,0)_100%),radial-gradient(ellipse_at_50%_58%,rgba(238,223,191,0.24),rgba(238,223,191,0.11)_36%,rgba(238,223,191,0)_72%)] opacity-[0.88] blur-[38px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,252,246,0.045)_0%,rgba(255,252,246,0.015)_16%,rgba(255,252,246,0)_34%,rgba(17,24,31,0.012)_100%),radial-gradient(circle_at_50%_44%,rgba(255,255,255,0)_50%,rgba(17,24,31,0.02)_82%,rgba(13,18,24,0.052)_100%)]" />

      {/* Terrain shimmer — faint ground-plane shapes that hint at landscape */}
      <div className="absolute inset-0">
        <div
          className="absolute left-[10%] top-[52%] h-[28%] w-[35%] rounded-[40%] bg-white/[0.025] blur-[60px]"
          style={{ animation: "skeleton-breathe 3s ease-in-out infinite" }}
        />
        <div
          className="absolute right-[8%] top-[46%] h-[32%] w-[30%] rounded-[40%] bg-white/[0.02] blur-[50px]"
          style={{
            animation: "skeleton-breathe 3s ease-in-out 0.8s infinite",
          }}
        />
        <div
          className="absolute left-[30%] top-[60%] h-[20%] w-[40%] rounded-[40%] bg-[rgba(174,214,245,0.02)] blur-[45px]"
          style={{
            animation: "skeleton-breathe 3s ease-in-out 1.6s infinite",
          }}
        />
      </div>

      {/* Top bar skeleton */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between px-5 py-4">
        <div
          className="mt-2 h-6 w-44 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 100%)",
            backgroundSize: "200% 100%",
            animation: "skeleton-shimmer 1.8s ease-in-out infinite",
          }}
        />
        <div className="absolute left-1/2 top-4 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-[28px] border border-white/10 bg-[rgba(28,25,26,0.82)] p-[7px] shadow-[0_18px_50px_rgba(4,16,28,0.22)] backdrop-blur-md">
            <SkeletonBlock className="h-11 w-24 rounded-[22px]" delay={0} />
            <SkeletonBlock className="h-11 w-24 rounded-[22px]" delay={0.1} />
            <div className="mx-1 h-8 w-px bg-white/8" />
            <SkeletonBlock className="h-11 w-11 rounded-[18px]" delay={0.2} />
          </div>
        </div>
        <SkeletonBlock
          className="h-8 w-24 rounded-full border border-white/10"
          delay={0.15}
        />
      </div>

      {/* Parcel badge skeletons — circular, staggered */}
      <SkeletonBadge className="left-[40%] top-[40%]" delay={0.3} />
      <SkeletonBadge className="left-[48%] top-[46%]" delay={0.5} />
      <SkeletonBadge className="left-[44%] top-[52%]" delay={0.7} />

      {/* Bottom loader card */}
      <div className="absolute bottom-8 left-1/2 flex w-[min(92vw,440px)] -translate-x-1/2 flex-col items-center rounded-[30px] border border-white/10 bg-[rgba(21,26,32,0.74)] px-6 py-5 text-center shadow-[0_24px_80px_rgba(4,16,28,0.24)] backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/52">
          <span
            className="h-2 w-2 rounded-full bg-white/50"
            style={{ animation: "skeleton-dot 1.4s ease-in-out infinite" }}
          />
          Preparing Viewer
        </div>
        <SkeletonBlock
          className="mt-3 h-7 w-48 rounded-full"
          delay={0.1}
        />
        <SkeletonBlock
          className="mt-3 h-3 w-full max-w-[280px] rounded-full"
          delay={0.2}
          dim
        />
        <SkeletonBlock
          className="mt-2 h-3 w-40 rounded-full"
          delay={0.3}
          dim
        />
      </div>

      <style jsx>{`
        @keyframes skeleton-shimmer {
          0%,
          100% {
            background-position: 200% 0;
          }
          50% {
            background-position: -200% 0;
          }
        }
        @keyframes skeleton-breathe {
          0%,
          100% {
            opacity: 0.4;
          }
          50% {
            opacity: 1;
          }
        }
        @keyframes skeleton-dot {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        @keyframes skeleton-fade-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

function SkeletonBlock({
  className = "",
  delay = 0,
  dim = false,
}: {
  className?: string;
  delay?: number;
  dim?: boolean;
}) {
  const base = dim ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)";
  const peak = dim ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.12)";

  return (
    <div
      className={className}
      style={{
        background: `linear-gradient(90deg, ${base} 0%, ${peak} 50%, ${base} 100%)`,
        backgroundSize: "200% 100%",
        animation: `skeleton-shimmer 1.8s ease-in-out ${delay}s infinite`,
        opacity: 0,
        animationFillMode: "backwards",
        animationName: "skeleton-fade-in, skeleton-shimmer",
        animationDuration: `0.4s, 1.8s`,
        animationDelay: `${delay}s, ${delay}s`,
        animationIterationCount: "1, infinite",
        animationTimingFunction: "ease-out, ease-in-out",
      }}
    />
  );
}

function SkeletonBadge({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`absolute size-11 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_1px_6px_rgba(0,0,0,0.45)] ${className}`}
      style={{
        backgroundColor: "rgba(10, 10, 10, 0.78)",
        boxShadow:
          "0 1px 6px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.12)",
        opacity: 0,
        animation: `skeleton-fade-in 0.5s ease-out ${delay}s forwards`,
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)",
          backgroundSize: "200% 100%",
          animation: `skeleton-shimmer 1.8s ease-in-out ${delay}s infinite`,
        }}
      />
    </div>
  );
}
