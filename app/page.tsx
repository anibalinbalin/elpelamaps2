import type { Metadata } from "next";
import Link from "next/link";
import { LandingImageMotion } from "@/components/landing-image-motion";

export const metadata: Metadata = {
  title: "Parcel Pin",
  description:
    "A platform for choosing premium land with clarity.",
};

export default function HomePage() {
  return (
    <main
      className="min-h-dvh"
      style={{
        background: "#F9F6EF",
        fontFamily: "var(--font-sans)",
      }}
    >
      <style>{`html,body{background:#F9F6EF;margin:0;}`}</style>

      {/* ── Header ── */}
      <header
        id="site-header"
        aria-label="Site header"
        className="mx-auto flex max-w-[800px] items-center justify-between px-5 pt-[10vh] max-sm:pt-[5vh]"
      >
        <span
          className="text-xl leading-none"
          style={{ fontFamily: "var(--font-display)", color: "rgba(0,0,0,1)" }}
        >
          Parcel Pin
        </span>
        <a
          href="mailto:anibalin@gmail.com?subject=Parcel Pin"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 no-underline"
          style={{ background: "#EDEADF", color: "rgba(0,0,0,1)" }}
        >
          <span>request a private demonstration</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M22 7l-10 6L2 7" />
          </svg>
        </a>
      </header>

      {/* ── Hero ── */}
      <section id="hero" aria-label="Hero" className="py-10 sm:py-20">
        <div className="mx-auto max-w-[800px] px-5">
          <div
            className="mb-6 text-sm uppercase"
            style={{
              color: "rgba(0,0,0,0.55)",
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.08em",
            }}
          >
            Premium parcel selection for exceptional land
          </div>

          {/* Hero image — replace with aerial José Ignacio photograph */}
          <div
            className="flex w-full items-center justify-center overflow-hidden"
            style={{
              aspectRatio: "4 / 3",
              background:
                "linear-gradient(180deg, #C4BFB2 0%, #D8D4C8 50%, #F9F6EF 100%)",
            }}
          >
            <span
              className="text-xs uppercase tracking-[0.15em] select-none"
              style={{ color: "rgba(0,0,0,0.10)" }}
            >
              josé ignacio
            </span>
          </div>

          {/* Wordmark — overlaps bottom of hero image */}
          <h1
            className="relative z-10 text-center"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(5rem, 18vw, 11rem)",
              fontWeight: 400,
              lineHeight: 0.85,
              letterSpacing: "-0.02em",
              color: "rgba(0,0,0,1)",
              marginTop: "-0.28em",
            }}
          >
            Choose
            <br />
            land with clarity.
          </h1>

          <p
            className="mt-12 text-pretty sm:mt-16"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(24px, 4vw, 34px)",
              fontWeight: 400,
              lineHeight: "110%",
              color: "rgba(0,0,0,0.6)",
            }}
          >
            Parcel Pin helps buyers see what static plans cannot: how orientation,
            privacy, context, and atmosphere shape the parcel that truly fits.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:anibalin@gmail.com?subject=Parcel Pin"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 no-underline"
              style={{ background: "rgba(0,0,0,1)", color: "#F9F6EF" }}
            >
              <span>request a private demonstration</span>
            </a>
            <Link
              href="/viewer"
              className="inline-flex items-center gap-2 rounded-full px-4 py-2 no-underline"
              style={{ background: "#EDEADF", color: "rgba(0,0,0,1)" }}
            >
              <span>explore the parcel experience</span>
            </Link>
          </div>

          <div
            className="mt-12 text-xs uppercase sm:mt-14"
            style={{
              color: "rgba(0,0,0,0.45)",
              fontFamily: "var(--font-sans)",
              letterSpacing: "0.08em",
            }}
          >
            Scroll down
          </div>

          <p
            className="mt-16 text-pretty sm:mt-20"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(26px, 4.5vw, 48px)",
              fontWeight: 400,
              lineHeight: "110%",
              color: "rgba(0,0,0,0.6)",
            }}
          >
            Imagine choosing land not from a plan, but from the land itself.
            Seeing how light, privacy, and setting shape each parcel before you
            commit. That is{" "}
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontStyle: "italic",
                color: "rgba(0,0,0,1)",
              }}
            >
              Parcel Pin
            </span>.
          </p>
        </div>
      </section>

      <LandingImageMotion />

      {/* ── Why ── */}
      <section
        id="why-sales-fall-short"
        aria-label="Why existing sales materials fall short"
        className="mx-auto max-w-[800px] px-5"
      >
        <SectionLabel>Why existing sales materials fall short</SectionLabel>

        <Paragraph>
          <Lead>Premium land is rarely chosen by boundary lines alone.</Lead>{" "}
          Static plans can show availability, but they flatten the subtle
          differences that determine how a parcel will actually feel to live
          in.
        </Paragraph>

        <Paragraph>
          <Lead>In places like José Ignacio, buyers are choosing more than land.</Lead>{" "}
          They are choosing light, exposure, privacy, approach, and the setting
          for a future life.
        </Paragraph>

        <Paragraph>
          <Lead>Parcel Pin turns that decision from instinct alone into clarity.</Lead>{" "}
          It helps buyers move from broad attraction to a stronger, more
          confident shortlist.
        </Paragraph>
      </section>

      {/* ── What it reveals ── */}
      <section
        id="what-parcelpin-reveals"
        aria-label="What Parcel Pin reveals"
        className="mx-auto max-w-[800px] px-5 pt-3"
      >
        <SectionLabel>What Parcel Pin reveals</SectionLabel>

        <RevealRow
          title="Orientation and light"
          copy="See how sun, exposure, and atmosphere shape the lived feel of each parcel across the day."
        />
        <RevealRow
          title="Privacy and adjacency"
          copy="Understand which parcels feel secluded, which feel connected, and where tradeoffs become visible."
        />
        <RevealRow
          title="Landscape and setting"
          copy="Read what brochures flatten: approach, surroundings, context, and the character of place."
        />
        <RevealRow
          title="Selection with judgment"
          copy="Move beyond availability and compare parcels by lifestyle fit, future use, and emotional alignment."
        />
      </section>

      {/* ── Developer proof ── */}
      <section
        id="why-developers-use-it"
        aria-label="Why developers use it"
        className="mx-auto max-w-[800px] px-5 pt-8"
      >
        <SectionLabel>Why developers use it</SectionLabel>

        <Paragraph>
          <Lead>A more discerning way to present a premium development.</Lead>{" "}
          Parcel Pin elevates project perception without becoming a brochure or a
          gimmick.
        </Paragraph>

        <CompactProof>It helps buyers understand parcel distinctions faster and with more confidence.</CompactProof>
        <CompactProof>It creates more qualified interest because selection replaces passive browsing.</CompactProof>
        <CompactProof>It gives exceptional land the standard of presentation it deserves.</CompactProof>
      </section>

      {/* ── Final CTA ── */}
      <section
        id="final-cta"
        aria-label="Final call to action"
        className="mx-auto max-w-[800px] px-5 pt-8"
      >
        <Paragraph>
          <Lead>Premium land should be chosen with more than instinct alone.</Lead>{" "}
          Parcel Pin brings atmosphere, discernment, and decision support into one
          experience.
        </Paragraph>
      </section>

      {/* ── Footer ── */}
      <footer
        id="site-footer"
        aria-label="Site footer"
        className="mx-auto flex max-w-[800px] flex-col gap-5 px-5 pb-[10vh] pt-[2vh] sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="py-2" style={{ color: "rgba(0,0,0,0.6)" }}>
          José Ignacio, Uruguay ·{" "}
          <a
            href="mailto:anibalin@gmail.com"
            className="no-underline"
            style={{ color: "rgba(0,0,0,1)", fontWeight: 500 }}
          >
            anibalin@gmail.com
          </a>
        </span>
        <div className="flex gap-2">
          <a
            href="mailto:anibalin@gmail.com?subject=Parcel Pin"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 no-underline"
            style={{ background: "rgba(0,0,0,1)", color: "#F9F6EF" }}
          >
            <span>discuss a project</span>
          </a>
          <Link
            href="/viewer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 no-underline"
            style={{ background: "#EDEADF", color: "rgba(0,0,0,1)" }}
          >
            <span>open the experience</span>
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
          </Link>
        </div>
      </footer>
    </main>
  );
}

/* ── Primitives ── */

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-xl leading-[120%] sm:text-2xl"
      style={{ color: "rgba(0,0,0,0.6)", marginBottom: "4.5vh" }}
    >
      {children}
    </p>
  );
}

function Lead({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "rgba(0,0,0,1)" }}>{children}</span>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-6 text-sm uppercase"
      style={{
        color: "rgba(0,0,0,0.55)",
        fontFamily: "var(--font-sans)",
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </div>
  );
}

function RevealRow({
  title,
  copy,
}: {
  title: string;
  copy: string;
}) {
  return (
    <div
      className="border-t py-5"
      style={{ borderColor: "rgba(0,0,0,0.12)" }}
    >
      <p
        className="mb-2 text-xl sm:text-2xl"
        style={{ color: "rgba(0,0,0,1)", lineHeight: "115%" }}
      >
        {title}
      </p>
      <p
        className="text-lg sm:text-xl"
        style={{ color: "rgba(0,0,0,0.6)", lineHeight: "125%" }}
      >
        {copy}
      </p>
    </div>
  );
}

function CompactProof({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-lg leading-[125%] sm:text-xl"
      style={{ color: "rgba(0,0,0,0.6)", marginBottom: "2.4vh" }}
    >
      {children}
    </p>
  );
}
