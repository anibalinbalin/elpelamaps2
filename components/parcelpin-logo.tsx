"use client";

type ParcelPinLogoProps = {
  className?: string;
  showWordmark?: boolean;
  size?: "header" | "footer";
  tone?: "bright" | "muted";
};

type ParcelPinMarkProps = {
  width?: number;
  height?: number;
  decorative?: boolean;
};

const SIZE_PRESETS = {
  header: {
    gap: 12,
    markWidth: 30,
    markHeight: 26,
    fontSize: "1.075rem",
    letterSpacing: "0.08em",
  },
  footer: {
    gap: 10,
    markWidth: 24,
    markHeight: 21,
    fontSize: "0.9rem",
    letterSpacing: "0.1em",
  },
} as const;

export function ParcelPinMark({
  width = 30,
  height = 26,
  decorative = false,
}: ParcelPinMarkProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden={decorative}
      aria-label={decorative ? undefined : "Parcel Pin mark"}
    >
      {/* Dome / arch */}
      <path
        d="M28,56 A22,22 0 0,1 72,56"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* Terrain lines */}
      <path
        d="M6,66 Q50,59 94,66"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        d="M14,76 Q50,69 86,76"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      <path
        d="M24,86 Q52,79 76,86"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ParcelPinLogo({
  className,
  showWordmark = true,
  size = "header",
  tone = "bright",
}: ParcelPinLogoProps) {
  const preset = SIZE_PRESETS[size];
  const color = tone === "muted" ? "rgba(255, 255, 255, 0.34)" : "#FFFFFF";

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${preset.gap}px`,
        color,
      }}
    >
      <ParcelPinMark
        width={preset.markWidth}
        height={preset.markHeight}
        decorative={showWordmark}
      />
      {showWordmark ? (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: preset.fontSize,
            lineHeight: 1,
            letterSpacing: preset.letterSpacing,
            color: "inherit",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}
        >
          Parcel Pin
        </span>
      ) : null}
    </div>
  );
}
