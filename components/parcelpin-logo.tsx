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
    markHeight: 38,
    fontSize: "1.075rem",
    letterSpacing: "0.08em",
  },
  footer: {
    gap: 10,
    markWidth: 24,
    markHeight: 30,
    fontSize: "0.9rem",
    letterSpacing: "0.1em",
  },
} as const;

export function ParcelPinMark({
  width = 30,
  height = 38,
  decorative = false,
}: ParcelPinMarkProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 40 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden={decorative}
      aria-label={decorative ? undefined : "Parcel Pin mark"}
    >
      <path
        d="M20 4C11.716 4 6 9.923 6 17.888C6 28.241 14.106 34.685 20 44C25.894 34.685 34 28.241 34 17.888C34 9.923 28.284 4 20 4Z"
        stroke="#F7F2E8"
        strokeWidth="1.6"
      />
      <circle cx="27.4" cy="12.1" r="2.25" fill="#D8AE74" />
      <path
        d="M12.6 20.2L20 16.3L27.4 20.2L20 24.4L12.6 20.2Z"
        fill="#D8AE74"
        fillOpacity="0.14"
        stroke="#F7F2E8"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M16.35 18.25V22.15M20 16.3V24.4M23.65 18.25V22.15"
        stroke="#F7F2E8"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M20 24.7V30.2"
        stroke="#D8AE74"
        strokeWidth="1.3"
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
  const wordmarkColor =
    tone === "muted" ? "rgba(255, 255, 255, 0.34)" : "#FFFFFF";

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: `${preset.gap}px`,
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
            color: wordmarkColor,
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
