"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

const CARD_DATA = [
  {
    id: "visits",
    label: "Qualified visits only",
    description:
      "Buyers explore sun, privacy, and views on their own. Site visits become confirmations, not discoveries.",
    image: "/landing/card-overview.jpg",
    expanded: {
      headline: "Self-guided exploration.",
      body: "Each lot gets its own viewer link. Buyers orbit the terrain, check sun exposure at different hours, measure the tree line from every angle. They share the link with their partner. By the time they call, both of them know which lot fits.",
      detail:
        "Real elevation data from satellite surveys. Sun position calculated to the minute for any date. Surrounding context — roads, neighbors, vegetation — rendered from Google 3D Tiles.",
    },
  },
  {
    id: "competition",
    label: "Beyond renders and drone footage",
    description:
      "Interactive terrain with accurate sun positioning. Buyers control the angle, the time of day, the perspective.",
    image: "/landing/card-detail.jpg",
    expanded: {
      headline: "Not a render. Not a video.",
      body: "A static floor plan cannot show how morning light hits the east-facing lot. A drone video cannot let the buyer rotate and zoom on their own terms. The viewer puts them in the landscape, at the time of day that matters, from the angle that sells.",
      detail:
        "Atmospheric rendering with volumetric clouds, accurate sun arc, and time-of-day simulation. Built on Google Photorealistic 3D Tiles with sub-meter terrain accuracy.",
    },
  },
  {
    id: "cycle",
    label: "Shorter path to decision",
    description:
      "When both partners have already explored the lot together, the visit is a formality.",
    image: "/landing/card-selection.jpg",
    expanded: {
      headline: "Conviction before the visit.",
      body: "The buyer opens the link on their phone over coffee. They orbit the lot, check where the sun sets, see how close the neighbor is. They send it to their partner. By Saturday, both of them already agree. The visit confirms what they felt.",
      detail:
        "Works on any device — phone, tablet, desktop. No app installation, no login required. One link per lot, shareable instantly.",
    },
  },
];

const elevation = {
  2: "inset 0 1px 0 0 rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.02), 0 1px 1px -0.5px rgba(0,0,0,0.18)",
  3: "inset 0 1px 0 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.12), 0 1px 1px -0.5px rgba(0,0,0,0.18), 0 3px 3px -1.5px rgba(0,0,0,0.18)",
  4: "inset 0 1px 0 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 0 1px rgba(0,0,0,0.14), 0 1px 1px -0.5px rgba(0,0,0,0.18), 0 3px 3px -1.5px rgba(0,0,0,0.18), 0 6px 6px -3px rgba(0,0,0,0.18)",
};

export default function HomePage() {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const close = useCallback(() => setSelectedCard(null), []);

  useEffect(() => {
    if (!selectedCard) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [selectedCard, close]);

  const active = CARD_DATA.find((c) => c.id === selectedCard);

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
          Buyers arrive with conviction.
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
          An interactive viewer that presents your land with real terrain,
          accurate sunlight, and atmospheric detail. No app required.
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
          {CARD_DATA.map((card) => (
            <FeatureCard
              key={card.id}
              label={card.label}
              description={card.description}
              image={card.image}
              onSelect={() => setSelectedCard(card.id)}
            />
          ))}
        </div>

        <AnimatePresence>
          {active && (
            <ExpandedCard
              card={active}
              onClose={close}
              reducedMotion={!!prefersReducedMotion}
            />
          )}
        </AnimatePresence>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-[1200px] px-6 pt-24 sm:px-10 sm:pt-32">
        <h2
          className="mb-10 text-xs uppercase tracking-[0.15em] sm:mb-12"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          How it works
        </h2>
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-12">
          <Step
            number="1"
            title="Send us your lot plan"
            description="A subdivision PDF or DWG with lot coordinates. That's all we need to start."
          />
          <Step
            number="2"
            title="We build the viewer"
            description="Each lot gets real terrain, sun path, atmosphere, and surrounding context. Ready in 48 hours."
          />
          <Step
            number="3"
            title="Share one link"
            description="Buyers explore on any device. No app, no login. They arrive at the site visit already decided."
          />
        </div>
      </section>

      {/* Viewer teaser */}
      <section className="mx-auto max-w-[1200px] px-6 pt-24 sm:px-10 sm:pt-32">
        <motion.div
          className="flex flex-col items-center gap-6 rounded-2xl bg-white/[0.03] px-6 py-12 text-center sm:px-12 sm:py-16"
          style={{ boxShadow: elevation[3] }}
          whileHover={{ boxShadow: elevation[4] }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <p
            className="text-sm uppercase tracking-[0.15em]"
            style={{ color: "rgba(255,255,255,0.4)" }}
          >
            See what buyers see
          </p>
          <h2
            className="max-w-xl text-pretty"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "clamp(1.5rem, 3.5vw, 2.25rem)",
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              color: "#ffffff",
            }}
          >
            Explore the viewer.
          </h2>
          <p
            className="max-w-md text-pretty"
            style={{
              fontFamily: "var(--font-inter)",
              fontSize: "1rem",
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Real terrain, real sunlight, real scale.
            <br className="hidden sm:block" />
            Works in any browser.
          </p>
          <div className="mt-2">
            <FluidButton href="/viewer" variant="primary">
              Explore the demo
              <ArrowIcon />
            </FluidButton>
          </div>
        </motion.div>
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
          Present your land properly.
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
  onSelect,
}: {
  label: string;
  description: string;
  image: string;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      className="group cursor-pointer rounded-xl bg-white/[0.03] p-5 text-left focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none sm:p-6"
      style={{ boxShadow: elevation[3] }}
      whileHover={{ boxShadow: elevation[4] }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="mb-4 aspect-[4/3] overflow-hidden rounded-lg">
        <img
          src={image}
          alt={label}
          width={400}
          height={300}
          className="h-full w-full object-cover transition-transform duration-200 [@media(hover:hover)]:group-hover:scale-[1.03]"
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
    </motion.button>
  );
}

function ExpandedCard({
  card,
  onClose,
  reducedMotion,
}: {
  card: (typeof CARD_DATA)[number];
  onClose: () => void;
  reducedMotion: boolean;
}) {
  const easeOutQuad = [0.25, 0.46, 0.45, 0.94] as const;
  const fade = reducedMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: easeOutQuad };

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={fade}
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
        style={{ overscrollBehavior: "contain" }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={card.label}
          className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-[#222228]"
          style={{ boxShadow: elevation[4] }}
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
          transition={fade}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="aspect-[16/9] overflow-hidden">
            <img
              src={card.image}
              alt=""
              width={672}
              height={378}
              className="h-full w-full object-cover"
            />
          </div>

          <div className="p-6 sm:p-8">
            <h3
              className="text-xl font-medium text-white sm:text-2xl"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {card.label}
            </h3>

            <motion.div
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reducedMotion ? { duration: 0 } : { delay: 0.1, duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <p
                className="mt-4 text-lg font-medium text-white/80"
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {card.expanded.headline}
              </p>
              <p
                className="mt-3 leading-relaxed"
                style={{
                  fontFamily: "var(--font-inter)",
                  fontSize: "0.95rem",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {card.expanded.body}
              </p>
              <p
                className="mt-3 text-sm leading-relaxed"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {card.expanded.detail}
              </p>
            </motion.div>
          </div>

          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:outline-none"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      </div>
    </>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-white/60"
        style={{ fontFamily: "var(--font-inter)", boxShadow: elevation[2] }}
      >
        {number}
      </span>
      <div>
        <p
          className="text-lg text-white/80"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {title}
        </p>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {description}
        </p>
      </div>
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
