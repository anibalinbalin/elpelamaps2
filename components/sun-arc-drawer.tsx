// components/sun-arc-drawer.tsx
"use client";

import { useRef, useState, useCallback, useId } from "react";

// Quadratic bezier control points — viewBox "0 0 328 58"
const P0: [number, number] = [12, 53];
const P1: [number, number] = [164, -14];
const P2: [number, number] = [316, 53];

/** Parametric point on the quadratic bezier at t ∈ [0,1] */
function bezierPoint(t: number): [number, number] {
  const mt = 1 - t;
  return [
    mt * mt * P0[0] + 2 * mt * t * P1[0] + t * t * P2[0],
    mt * mt * P0[1] + 2 * mt * t * P1[1] + t * t * P2[1],
  ];
}

/** Convert clientX drag position to arc t value [0,1] */
function clientXToT(clientX: number, svgEl: SVGSVGElement): number {
  const rect = svgEl.getBoundingClientRect();
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
}

/** Format arc t value as a locale time string (6:00 AM → 12:00 AM) */
function tToTimeString(t: number): string {
  const totalMinutes = Math.round(t * 18 * 60); // 18-hour range
  const hour24 = 6 + Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const d = new Date();
  d.setHours(hour24 % 24, minutes, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// t ≥ DUSK_T → show moon, activate night shader
// t where sun reaches horizon: (SUNSET_HOUR=20.25 - 6) / 18 ≈ 0.792
const DUSK_T = 0.79; // moon appears as sun dips below the horizon

export interface SunArcDrawerProps {
  sunT: number;
  onSunT: (t: number) => void;
}

export function SunArcDrawer({ sunT, onSunT }: SunArcDrawerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const [hintSeen, setHintSeen] = useState(false);
  const uid = useId().replace(/:/g, "");

  const isNight = sunT >= DUSK_T;
  const [bx, by] = bezierPoint(sunT);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      draggingRef.current = true;
      svgRef.current.setPointerCapture(e.pointerId);
      onSunT(clientXToT(e.clientX, svgRef.current));
      setHintSeen(true);
    },
    [onSunT],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingRef.current || !svgRef.current) return;
      onSunT(clientXToT(e.clientX, svgRef.current));
    },
    [onSunT],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  return (
    <div className="sun-arc-enter pointer-events-none fixed inset-x-0 bottom-12 z-30 flex justify-center px-3">
      <div className="pointer-events-auto w-full max-w-[360px] rounded-[20px] border border-white/9 bg-[rgba(16,20,25,0.93)] px-4 pb-3 pt-3 shadow-[0_28px_80px_rgba(3,10,16,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[28px]">
        {/* Time row */}
        <div className="mb-2 flex items-center justify-between">
          <span
            className={`text-[13px] font-semibold tracking-[-0.02em] transition-colors duration-300 ${
              isNight ? "text-[rgba(170,190,255,0.8)]" : "text-[rgba(255,255,255,0.82)]"
            }`}
          >
            {tToTimeString(sunT)}
          </span>
          <span
            className={`text-[10px] tracking-[0.04em] text-white/28 transition-opacity duration-300 ${
              hintSeen ? "opacity-0" : "opacity-100"
            }`}
          >
            drag arc
          </span>
        </div>

        {/* Arc SVG — drag target */}
        <svg
          ref={svgRef}
          viewBox="0 0 328 58"
          className="w-full cursor-ew-resize touch-none select-none overflow-visible"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            <linearGradient id={`arcGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#0d2a5c" stopOpacity="0.7" />
              <stop offset="28%"  stopColor="#e67e22" />
              <stop offset="52%"  stopColor="#f1c40f" />
              <stop offset="72%"  stopColor="#e74c3c" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#0d1838" stopOpacity="0.6" />
            </linearGradient>
            <radialGradient id={`sunFill-${uid}`} cx="40%" cy="35%">
              <stop offset="0%"   stopColor="#fffde0" />
              <stop offset="55%"  stopColor="#ffd700" />
              <stop offset="100%" stopColor="#ff8800" />
            </radialGradient>
            <filter id={`glow-${uid}`}>
              <feGaussianBlur stdDeviation="2.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Horizon line */}
          <line x1="4" y1="53" x2="324" y2="53" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

          {/* Ghost arc (full range) */}
          <path
            d="M 12,53 Q 164,-14 316,53"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1.5"
            fill="none"
            style={{ pointerEvents: "none" }}
          />

          {/* Colored arc */}
          <path
            d="M 12,53 Q 164,-14 316,53"
            stroke={`url(#arcGrad-${uid})`}
            strokeWidth="2.5"
            fill="none"
            style={{ pointerEvents: "none" }}
          />

          {/* Sun ball or crescent moon */}
          {isNight ? (
            <>
              {/* Moon glow */}
              <circle cx={bx} cy={by} r={10} fill="rgba(180,200,255,0.07)" style={{ pointerEvents: "none" }} />
              {/* Moon disc */}
              <circle cx={bx} cy={by} r={6} fill="rgba(210,225,255,0.85)" filter={`url(#glow-${uid})`} style={{ pointerEvents: "none" }} />
              {/* Crescent cutout */}
              <circle cx={bx + 4} cy={by - 2} r={5} fill="rgba(14,18,30,0.92)" style={{ pointerEvents: "none" }} />
            </>
          ) : (
            <>
              {/* Sun halo */}
              <circle cx={bx} cy={by} r={13} fill="rgba(255,200,50,0.10)" style={{ pointerEvents: "none" }} />
              {/* Sun disc */}
              <circle cx={bx} cy={by} r={7.5} fill={`url(#sunFill-${uid})`} filter={`url(#glow-${uid})`} style={{ pointerEvents: "none" }} />
            </>
          )}

          {/* Time tick labels */}
          <text x="12"  y="52" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5" style={{ pointerEvents: "none" }}>6am</text>
          <text x="164" y="4"  textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5" style={{ pointerEvents: "none" }}>12pm</text>
          <text x="316" y="52" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5" style={{ pointerEvents: "none" }}>12am</text>
        </svg>
      </div>
    </div>
  );
}
