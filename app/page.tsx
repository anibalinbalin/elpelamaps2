"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const elevation = {
  2: "inset 0 1px 0 0 rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.02), 0 1px 1px -0.5px rgba(0,0,0,0.18)",
  3: "inset 0 1px 0 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.12), 0 1px 1px -0.5px rgba(0,0,0,0.18), 0 3px 3px -1.5px rgba(0,0,0,0.18)",
  4: "inset 0 1px 0 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 0 1px rgba(0,0,0,0.14), 0 1px 1px -0.5px rgba(0,0,0,0.18), 0 3px 3px -1.5px rgba(0,0,0,0.18), 0 6px 6px -3px rgba(0,0,0,0.18)",
};

export default function HomePage() {
  return (
    <main className="min-h-dvh bg-[#1a1a1f]">
      {/* Header */}
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 pt-8 sm:px-10 sm:pt-12">
        <span
          className="text-lg leading-none text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Parcel Pin
        </span>
        <FluidButton href="mailto:anibalin@gmail.com?subject=Parcel Pin" size="sm">
          Get in touch
        </FluidButton>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-[1200px] px-6 pt-16 sm:px-10 sm:pt-24">
        {/* Hero video */}
        <div
          className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl"
          style={{ boxShadow: elevation[3] }}
        >
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/landing/hero-poster.jpg"
            className="absolute inset-0 h-full w-full object-cover"
          >
            <source src="/landing/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1f]/60 via-transparent to-transparent" />
        </div>

        {/* Headline */}
        <h1
          className="mt-12 text-pretty sm:mt-16"
          style={{
            fontFamily: "var(--font-inter)",
            fontSize: "clamp(2rem, 5vw, 3.5rem)",
            fontWeight: 500,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: "#ffffff",
          }}
        >
          Buyers arrive already knowing
          <br className="hidden sm:block" />
          {" "}which lot they want.
        </h1>

        {/* Value prop */}
        <p
          className="mt-6 max-w-2xl text-pretty sm:mt-8"
          style={{
            fontFamily: "var(--font-inter)",
            fontSize: "clamp(1.1rem, 2.5vw, 1.35rem)",
            lineHeight: 1.5,
            color: "rgba(255,255,255,0.55)",
          }}
        >
          When buyers feel the light, the privacy, and the atmosphere before
          they visit — they arrive with conviction, not curiosity.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap gap-3 sm:mt-10">
          <FluidButton href="mailto:anibalin@gmail.com?subject=Parcel Pin" variant="primary">
            Get in touch
          </FluidButton>
          <FluidButton href="/viewer" variant="secondary">
            See it live
            <ArrowIcon />
          </FluidButton>
        </div>
      </section>

      {/* Feature cards */}
      <section className="mx-auto max-w-[1200px] px-6 pt-24 sm:px-10 sm:pt-32">
        <div className="grid gap-4 sm:grid-cols-3 sm:gap-6">
          <FeatureCard
            label="Fewer visits, faster decisions"
            description="Buyers self-select before the trip. The site visit confirms what they already feel."
            image="/landing/card-overview.jpg"
          />
          <FeatureCard
            label="Premium positioning"
            description="Your project looks like nothing else on the market. The presentation matches the land."
            image="/landing/card-detail.jpg"
          />
          <FeatureCard
            label="Conviction before the visit"
            description="They felt the orientation, the privacy, the setting. They arrive ready to commit."
            image="/landing/card-selection.jpg"
          />
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1200px] px-6 pt-24 sm:px-10 sm:pt-32">
        <h2
          className="mb-10 text-xs uppercase tracking-[0.15em] sm:mb-12"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          How it works
        </h2>
        <div className="grid gap-8 sm:grid-cols-3 sm:gap-12">
          <Step number="1" title="Send us your lot plan" />
          <Step number="2" title="We build the experience" />
          <Step number="3" title="Share the link with buyers" />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-[1200px] px-6 pt-24 sm:px-10 sm:pt-32">
        <h2
          className="text-pretty"
          style={{
            fontFamily: "var(--font-inter)",
            fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
            fontWeight: 500,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
            color: "#ffffff",
          }}
        >
          Ready to show your land properly?
        </h2>
        <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
          <FluidButton href="mailto:anibalin@gmail.com?subject=Parcel Pin" variant="primary">
            Get in touch
          </FluidButton>
          <FluidButton href="/viewer" variant="secondary">
            Explore the viewer
            <ArrowIcon />
          </FluidButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-[1200px] flex-col gap-4 px-6 pb-12 pt-24 sm:flex-row sm:items-center sm:justify-between sm:px-10 sm:pt-32">
        <span
          className="text-sm"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          José Ignacio, Uruguay ·{" "}
          <a
            href="mailto:anibalin@gmail.com"
            className="text-white/70 no-underline transition-colors hover:text-white"
          >
            anibalin@gmail.com
          </a>
        </span>
        <span
          className="text-sm"
          style={{
            fontFamily: "var(--font-display)",
            color: "rgba(255,255,255,0.25)",
          }}
        >
          Parcel Pin
        </span>
      </footer>
    </main>
  );
}

/* ── Components ── */

function FluidButton({
  href,
  variant = "primary",
  size = "md",
  children,
}: {
  href: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  const isExternal = href.startsWith("mailto:") || href.startsWith("http");

  const styles = {
    primary: "bg-white text-[#0a0a0a] hover:bg-white/90",
    secondary:
      "bg-white/[0.08] text-white hover:bg-white/[0.14]",
  };

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-sm",
  };

  const className = `inline-flex items-center gap-2 rounded-full font-medium no-underline transition-colors ${styles[variant]} ${sizes[size]}`;
  const shadow = variant === "secondary" ? elevation[2] : undefined;

  if (isExternal) {
    return (
      <motion.a
        href={href}
        className={className}
        style={shadow ? { boxShadow: shadow } : undefined}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="inline-flex"
      style={shadow ? { boxShadow: shadow } : undefined}
    >
      <Link href={href} className={className}>
        {children}
      </Link>
    </motion.div>
  );
}

function FeatureCard({
  label,
  description,
  image,
}: {
  label: string;
  description: string;
  image: string;
}) {
  return (
    <motion.div
      className="group rounded-xl bg-white/[0.03] p-5 sm:p-6"
      style={{ boxShadow: elevation[3] }}
      whileHover={{ boxShadow: elevation[4] }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="mb-4 aspect-[4/3] overflow-hidden rounded-lg">
        <img
          src={image}
          alt={label}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
      </div>
      <h3
        className="mb-2 text-base font-medium text-white sm:text-lg"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {label}
      </h3>
      <p
        className="text-sm leading-relaxed"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        {description}
      </p>
    </motion.div>
  );
}

function Step({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-start gap-4">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-white/60"
        style={{ fontFamily: "var(--font-inter)", boxShadow: elevation[2] }}
      >
        {number}
      </span>
      <p
        className="pt-1 text-lg text-white/80"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        {title}
      </p>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M17 7H7M17 7V17" />
    </svg>
  );
}
