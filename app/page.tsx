"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { ParcelPinLogo } from "@/components/parcelpin-logo";


function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          observer.unobserve(el);
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

function Reveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const ref = useScrollReveal();
  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(24px)",
        transition: `opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

const HERO_CAPTIONS = [
  "Buyers explore sun, terrain, and views on their own terms.",
  "Real elevation data. Sun position calculated to the minute.",
  "Works on any device — phone, tablet, desktop. One link per lot.",
];

function useScrollProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);
  const handleScroll = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const total = ref.current.offsetHeight - window.innerHeight;
    if (total <= 0) return;
    const scrolled = -rect.top;
    setProgress(Math.max(0, Math.min(1, scrolled / total)));
  }, [ref]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return progress;
}

export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const progress = useScrollProgress(heroRef);

  const captionIndex = Math.min(
    Math.floor(progress * (HERO_CAPTIONS.length + 1)),
    HERO_CAPTIONS.length - 1
  );
  const showCaptions = progress > 0.05 && progress < 0.85;
  const showTransition = progress > 0.8;

  return (
    <main>
      {/* ── Hero: sticky scroll section ── */}
      <section
        ref={heroRef}
        style={{
          height: "400vh",
          position: "relative",
          backgroundColor: "var(--color-sky-blue)",
        }}
      >
        {/* Sticky viewport */}
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Nav */}
          <header
            style={{
              position: "relative",
              zIndex: 20,
              padding: "24px 40px",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                maxWidth: "960px",
                margin: "0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
            <ParcelPinLogo size="header" tone="bright" />
            <a
              href="mailto:hello@parcelpin.com?subject=Parcel Pin"
              style={{
                fontFamily: "var(--font-text)",
                fontSize: "14px",
                fontWeight: 450,
                letterSpacing: "-0.14px",
                color: "var(--color-cockpit)",
                backgroundColor: "var(--color-cream)",
                borderRadius: "120px",
                padding: "10px 22px",
                textDecoration: "none",
              }}
            >
              Get in touch
            </a>
            </div>
          </header>

          {/* Video container with rounded corners on blue */}
          <div
            style={{
              position: "relative",
              flex: 1,
              margin: "0 16px 16px",
              borderRadius: "24px",
              overflow: "hidden",
            }}
          >
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="none"
              poster="/landing/hero-poster.jpg"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            >
              <source src="/landing/hero.mp4" type="video/mp4" />
            </video>

            {/* Dark gradient at bottom for text legibility */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "50%",
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)",
                pointerEvents: "none",
              }}
            />

            {/* Hero title — fades out as you scroll */}
            <div
              style={{
                position: "absolute",
                bottom: "56px",
                left: "48px",
                right: "48px",
                zIndex: 10,
                opacity: showCaptions ? 0 : 1,
                transform: showCaptions
                  ? "translateY(-12px)"
                  : "translateY(0)",
                transition: "opacity 0.5s ease, transform 0.5s ease",
              }}
            >
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(40px, 8vw, 120px)",
                  fontWeight: 550,
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  color: "#fff",
                }}
              >
                Land, understood.
              </h1>
            </div>

            {/* Scroll captions — fade in as you scroll */}
            <div
              style={{
                position: "absolute",
                bottom: "56px",
                left: "48px",
                width: "460px",
                maxWidth: "calc(100% - 96px)",
                zIndex: 10,
                opacity: showCaptions ? 1 : 0,
                transition: "opacity 0.5s ease",
              }}
            >
              {HERO_CAPTIONS.map((caption, i) => (
                <p
                  key={i}
                  style={{
                    fontFamily: "var(--font-text)",
                    fontSize: "clamp(18px, 1.6vw, 24px)",
                    fontWeight: 500,
                    lineHeight: 1.25,
                    letterSpacing: "-0.24px",
                    color: "var(--color-cream)",
                    maxWidth: "460px",
                    paddingLeft: "20px",
                    borderLeft: "2px solid rgba(245, 244, 223, 0.5)",
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    opacity: captionIndex === i ? 1 : 0,
                    transform:
                      captionIndex === i
                        ? "translateY(0)"
                        : captionIndex > i
                          ? "translateY(-16px)"
                          : "translateY(16px)",
                    transition: "opacity 0.6s ease, transform 0.6s ease",
                  }}
                >
                  {caption}
                </p>
              ))}
            </div>
          </div>

          {/* Blue transition text — shows at end of scroll */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: showTransition ? 15 : 0,
              opacity: showTransition ? 1 : 0,
              transition: "opacity 0.6s ease",
              pointerEvents: "none",
              backgroundColor: "var(--color-sky-blue)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(40px, 7vw, 100px)",
                fontWeight: 550,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "var(--color-cream)",
                textAlign: "center",
                padding: "0 40px",
              }}
            >
              See the land
              <br />
              before you see the land.
            </h2>
          </div>
        </div>
      </section>

      {/* ── Before / After ── */}
      <BeforeAfterSection />

      {/* ── Feature sections on cream ── */}
      <section
        style={{
          backgroundColor: "var(--color-cream)",
          paddingTop: "80px",
        }}
      >
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <FeatureBlock
            video="/landing/card-overview.mp4"
            headline="One link per lot."
            text="Buyers orbit the terrain, check sun exposure at different hours, measure the tree line from every angle."
            cta="See it live"
            ctaHref="/viewer"
            align="left"
          />
          <FeatureBlock
            video="/landing/card-detail.mp4"
            headline="Light tells the truth."
            text="A static floor plan cannot show how morning light hits the lot. The viewer puts buyers in the landscape, at the time of day that matters."
            cta="Explore the viewer"
            ctaHref="/viewer"
            align="right"
          />
          <FeatureBlock
            video="/landing/card-selection.mp4"
            headline="Decided before Saturday."
            text="The buyer opens the link on their phone. They orbit the lot, check where the sun sets. They send it to their partner. Both already agree."
            cta="Try the demo"
            ctaHref="/viewer"
            align="left"
          />
          <FeatureBlock
            video="/landing/card-lot-click.mp4"
            headline="Tap a lot. See everything."
            text="Sun angle, terrain, trees — the viewer reveals what a map cannot. Buyers explore on their own terms, on any device."
            cta="Try it yourself"
            ctaHref="/viewer"
            align="right"
          />
          <FeatureBlock
            video="/landing/card-plot-edit.mp4"
            headline="Built for your subdivision."
            text="Send us your lot plan. We place every parcel on real terrain with accurate sun paths — ready to share in 48 hours."
            cta="Get in touch"
            ctaHref="mailto:hello@parcelpin.com?subject=Parcel Pin"
            align="left"
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section
        className="how-it-works-section"
        style={{
          backgroundColor: "var(--color-cream)",
          padding: "80px 40px 120px",
        }}
      >
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <Reveal>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(36px, 5vw, 64px)",
                fontWeight: 550,
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
                color: "var(--color-cockpit)",
                maxWidth: "600px",
              }}
            >
              From lot plan to live viewer in 48 hours.
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p
              style={{
                fontFamily: "var(--font-text)",
                fontSize: "clamp(16px, 1.4vw, 20px)",
                fontWeight: 400,
                lineHeight: 1.45,
                letterSpacing: "-0.2px",
                color: "var(--color-cockpit)",
                opacity: 0.5,
                maxWidth: "440px",
                marginTop: "24px",
              }}
            >
              Send us a subdivision plan. We handle the terrain, sunlight, and
              atmosphere. You get a link to share.
            </p>
          </Reveal>

          <div className="step-rows-container" style={{ marginTop: "80px" }}>
            <Reveal delay={0}>
              <StepRow number="01" title="Send us your lot plan" description="A subdivision PDF or DWG with lot coordinates. That's all we need." icon={<StepLotPlanIcon />} />
            </Reveal>
            <Reveal delay={0.1}>
              <StepRow number="02" title="We build the viewer" description="Real terrain, sun path, atmosphere, and surrounding context. Ready in 48 hours." icon={<StepViewerIcon />} />
            </Reveal>
            <Reveal delay={0.2}>
              <StepRow number="03" title="Share one link" description="Buyers explore on any device. No app, no login. They arrive already decided." icon={<StepShareIcon />} isLast />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── CTA — navy ── */}
      <section
        style={{
          backgroundColor: "var(--color-aviation-navy)",
          padding: "120px 40px 100px",
        }}
      >
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <Reveal>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(40px, 5vw, 80px)",
                fontWeight: 550,
                lineHeight: 1,
                letterSpacing: "-0.03em",
                color: "var(--color-cream)",
                maxWidth: "700px",
              }}
            >
              Ready when you are.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p
              style={{
                fontFamily: "var(--font-text)",
                fontSize: "clamp(16px, 1.4vw, 20px)",
                fontWeight: 400,
                lineHeight: 1.45,
                letterSpacing: "-0.2px",
                color: "rgba(245, 244, 223, 0.55)",
                maxWidth: "440px",
                marginTop: "24px",
              }}
            >
              One subdivision plan is all we need. Each lot gets its own viewer
              link within 48 hours.
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div style={{ display: "flex", gap: "12px", marginTop: "40px", flexWrap: "wrap" as const }}>
              <a
                href="mailto:hello@parcelpin.com?subject=Parcel Pin"
                style={{
                  fontFamily: "var(--font-text)",
                  fontSize: "14px",
                  fontWeight: 450,
                  letterSpacing: "-0.14px",
                  color: "var(--color-cockpit)",
                  backgroundColor: "var(--color-cream)",
                  borderRadius: "120px",
                  padding: "14px 28px",
                  textDecoration: "none",
                }}
              >
                Get in touch
              </a>
              <Link
                href="/viewer"
                style={{
                  fontFamily: "var(--font-text)",
                  fontSize: "14px",
                  fontWeight: 450,
                  letterSpacing: "-0.14px",
                  color: "var(--color-cream)",
                  border: "1.5px solid rgba(245, 244, 223, 0.25)",
                  borderRadius: "120px",
                  padding: "14px 28px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                Explore the viewer
                <ArrowIcon />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: "40px 40px 28px",
          backgroundColor: "var(--color-sky-blue)",
          borderTop: "1px solid rgba(245, 244, 223, 0.08)",
        }}
      >
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          {/* Top row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap" as const,
              gap: "24px",
              paddingBottom: "28px",
              borderBottom: "1px solid rgba(245, 244, 223, 0.1)",
            }}
          >
            {/* Brand + description */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "15px",
                  fontWeight: 600,
                  letterSpacing: "-0.3px",
                  color: "rgba(245, 244, 223, 0.9)",
                }}
              >
                Parcel Pin
              </span>
              <span
                style={{
                  fontFamily: "var(--font-text)",
                  fontSize: "13px",
                  fontWeight: 400,
                  color: "rgba(245, 244, 223, 0.4)",
                  maxWidth: "280px",
                  lineHeight: "1.5",
                }}
              >
                See the land before you see it in person. Real terrain, real sunlight, one link per lot.
              </span>
            </div>

            {/* Links row */}
            <nav style={{ display: "flex", gap: "24px", flexWrap: "wrap" as const }}>
              {["Features", "How it works", "Explore viewer"].map((label) => (
                <a
                  key={label}
                  href="#"
                  style={{
                    fontFamily: "var(--font-text)",
                    fontSize: "13px",
                    fontWeight: 450,
                    color: "rgba(245, 244, 223, 0.55)",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </a>
              ))}
            </nav>

            {/* Contact */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "right" as const }}>
              <a
                href="mailto:hello@parcelpin.com"
                style={{
                  fontFamily: "var(--font-text)",
                  fontSize: "13px",
                  fontWeight: 450,
                  color: "rgba(245, 244, 223, 0.6)",
                  textDecoration: "none",
                }}
              >
                hello@parcelpin.com
              </a>
              <span
                style={{
                  fontFamily: "var(--font-text)",
                  fontSize: "12px",
                  fontWeight: 400,
                  color: "rgba(245, 244, 223, 0.3)",
                }}
              >
                José Ignacio, Uruguay
              </span>
            </div>
          </div>

          {/* Bottom row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "16px",
              flexWrap: "wrap" as const,
              gap: "8px",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-text)",
                fontSize: "12px",
                fontWeight: 400,
                color: "rgba(245, 244, 223, 0.2)",
              }}
            >
              © 2026 Parcel Pin. All rights reserved.
            </span>
            <div style={{ display: "flex", gap: "16px" }}>
              {["Privacy policy", "Terms of service"].map((label) => (
                <a
                  key={label}
                  href="#"
                  style={{
                    fontFamily: "var(--font-text)",
                    fontSize: "12px",
                    fontWeight: 400,
                    color: "rgba(245, 244, 223, 0.2)",
                    textDecoration: "none",
                  }}
                >
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* ── Components ── */

function BeforeAfterSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (revealed && videoRef.current) {
      videoRef.current.play();
    }
  }, [revealed]);

  return (
    <section
      ref={sectionRef}
      style={{
        backgroundColor: "var(--color-cream)",
        padding: "120px 40px 40px",
      }}
    >
      <div style={{ maxWidth: "960px", margin: "0 auto" }}>
        <Reveal>
          <p
            style={{
              fontFamily: "var(--font-text)",
              fontSize: "14px",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase" as const,
              color: "var(--color-sky-blue)",
              marginBottom: "16px",
            }}
          >
            Before &amp; after
          </p>
        </Reveal>
        <Reveal delay={0.06}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 5vw, 64px)",
              fontWeight: 550,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              color: "var(--color-cockpit)",
              maxWidth: "700px",
            }}
          >
            From flat plan to full experience.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p
            style={{
              fontFamily: "var(--font-text)",
              fontSize: "clamp(16px, 1.4vw, 20px)",
              fontWeight: 400,
              lineHeight: 1.45,
              letterSpacing: "-0.2px",
              color: "var(--color-cockpit)",
              opacity: 0.5,
              maxWidth: "480px",
              marginTop: "20px",
            }}
          >
            A subdivision plan tells you where the lots are. The viewer lets you
            stand on them.
          </p>
        </Reveal>

        {/* Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
            marginTop: "56px",
          }}
          className="before-after-grid"
        >
          {/* Before */}
          <Reveal delay={0.12}>
            <div
              style={{
                position: "relative",
                borderRadius: "20px",
                overflow: "hidden",
                aspectRatio: "4 / 3",
                backgroundColor: "#e8e6d8",
              }}
            >
              <img
                src="/landing/before-map.png"
                alt="Static subdivision plan"
                loading="lazy"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "40px 28px 24px",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-text)",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "rgba(255,255,255,0.55)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  Before
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(18px, 2vw, 24px)",
                    fontWeight: 550,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    color: "#fff",
                    marginTop: "6px",
                  }}
                >
                  A flat image with lot numbers.
                </p>
              </div>
            </div>
          </Reveal>

          {/* After */}
          <Reveal delay={0.18}>
            <div
              style={{
                position: "relative",
                borderRadius: "20px",
                overflow: "hidden",
                aspectRatio: "4 / 3",
                backgroundColor: "var(--color-cockpit)",
              }}
            >
              <video
                ref={videoRef}
                muted
                loop
                playsInline
                preload="none"
                poster="/landing/before-after-poster.jpg"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: revealed ? 1 : 0.4,
                  transition: "opacity 1.2s ease",
                }}
              >
                <source src="/landing/before-after.mp4" type="video/mp4" />
              </video>
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: "40px 28px 24px",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-text)",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--color-sky-blue)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase" as const,
                  }}
                >
                  After
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(18px, 2vw, 24px)",
                    fontWeight: 550,
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    color: "#fff",
                    marginTop: "6px",
                  }}
                >
                  Terrain, sun, and atmosphere — explored live.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FeatureBlock({
  image,
  video,
  headline,
  text,
  cta,
  ctaHref,
  align,
}: {
  image?: string;
  video?: string;
  headline: string;
  text: string;
  cta: string;
  ctaHref: string;
  align: "left" | "right";
}) {
  const ref = useScrollReveal();
  const isLeft = align === "left";

  return (
    <div
      ref={ref}
      style={{
        padding: "0 16px",
        marginBottom: "40px",
        opacity: 0,
        transform: "translateY(24px)",
        transition:
          "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        willChange: "opacity, transform",
      }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: "24px",
          overflow: "hidden",
          minHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        {video ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          >
            <source src={video} type="video/mp4" />
          </video>
        ) : image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 40%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Content at bottom */}
        <div
          className="feature-content"
          style={{
            position: "relative",
            zIndex: 1,
            padding: "56px",
          }}
        >
          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "clamp(36px, 5vw, 64px)",
              fontWeight: 550,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: "#fff",
              order: isLeft ? 1 : 2,
            }}
          >
            {headline}
          </h3>

          <div
            style={{
              order: isLeft ? 2 : 1,
              display: "flex",
              flexDirection: "column",
              alignItems: isLeft ? "flex-end" : "flex-start",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-text)",
                fontSize: "clamp(16px, 1.2vw, 20px)",
                fontWeight: 450,
                lineHeight: 1.4,
                letterSpacing: "-0.2px",
                color: "rgba(255, 255, 255, 0.75)",
                maxWidth: "400px",
                textAlign: isLeft ? "right" : "left",
              }}
            >
              {text}
            </p>
            <a
              href={ctaHref}
              style={{
                fontFamily: "var(--font-text)",
                fontSize: "14px",
                fontWeight: 450,
                letterSpacing: "-0.14px",
                color: "#fff",
                border: "1.5px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "120px",
                padding: "10px 22px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "24px",
              }}
            >
              {cta}
              <ArrowIcon />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  number,
  title,
  description,
  icon,
  isLast,
}: {
  number: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className="step-row"
      style={{
        display: "grid",
        gridTemplateColumns: "80px 1fr 1fr",
        gap: "40px",
        alignItems: "baseline",
        padding: "36px 0",
        borderTop: "1px solid rgba(14,22,32,0.1)",
        ...(isLast ? { borderBottom: "1px solid rgba(14,22,32,0.1)" } : {}),
      }}
    >
      <span
        className="step-row-number"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "48px",
          fontWeight: 600,
          letterSpacing: "-0.04em",
          color: "var(--color-sky-blue)",
          lineHeight: 1,
        }}
      >
        {number}
      </span>
      <h3
        className="step-row-title"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(22px, 2.2vw, 28px)",
          fontWeight: 600,
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
          color: "var(--color-cockpit)",
          margin: 0,
        }}
      >
        {title}
      </h3>
      <div className="step-row-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <p
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "15px",
            fontWeight: 400,
            lineHeight: 1.5,
            color: "var(--color-cockpit)",
            opacity: 0.5,
            margin: 0,
          }}
        >
          {description}
        </p>
        {icon}
      </div>
    </div>
  );
}

function StepLotPlanIcon() {
  return (
    <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "200px", height: "auto", flexShrink: 0 }}>
      <rect x="15" y="20" width="170" height="135" stroke="#083E6F" strokeWidth="1.2" fill="none" style={{ opacity: 0.2 }} />
      <line x1="15" y1="72" x2="185" y2="72" stroke="#083E6F" strokeWidth="0.75" style={{ opacity: 0.15 }} />
      <line x1="15" y1="115" x2="140" y2="115" stroke="#083E6F" strokeWidth="0.75" style={{ opacity: 0.15 }} />
      <line x1="100" y1="20" x2="100" y2="72" stroke="#083E6F" strokeWidth="0.75" style={{ opacity: 0.15 }} />
      <line x1="70" y1="72" x2="70" y2="155" stroke="#083E6F" strokeWidth="0.75" style={{ opacity: 0.15 }} />
      <line x1="140" y1="72" x2="140" y2="155" stroke="#083E6F" strokeWidth="0.75" style={{ opacity: 0.15 }} />
      <line x1="70" y1="115" x2="140" y2="155" stroke="#083E6F" strokeWidth="0.75" style={{ opacity: 0.15 }} />
      <text x="48" y="52" fill="#083E6F" fontFamily="system-ui" fontSize="11" fontWeight="600" style={{ opacity: 0.18 }}>1</text>
      <text x="140" y="52" fill="#083E6F" fontFamily="system-ui" fontSize="11" fontWeight="600" style={{ opacity: 0.18 }}>2</text>
      <text x="35" y="98" fill="#083E6F" fontFamily="system-ui" fontSize="11" fontWeight="600" style={{ opacity: 0.18 }}>3</text>
      <text x="100" y="98" fill="#083E6F" fontFamily="system-ui" fontSize="11" fontWeight="600" style={{ opacity: 0.18 }}>4</text>
      <text x="158" y="120" fill="#083E6F" fontFamily="system-ui" fontSize="11" fontWeight="600" style={{ opacity: 0.18 }}>5</text>
      <text x="35" y="142" fill="#083E6F" fontFamily="system-ui" fontSize="11" fontWeight="600" style={{ opacity: 0.18 }}>6</text>
      <line x1="15" y1="13" x2="185" y2="13" stroke="#007AE5" strokeWidth="0.75" strokeDasharray="3 2" style={{ opacity: 0.5 }} />
      <line x1="15" y1="10" x2="15" y2="16" stroke="#007AE5" strokeWidth="0.75" style={{ opacity: 0.5 }} />
      <line x1="185" y1="10" x2="185" y2="16" stroke="#007AE5" strokeWidth="0.75" style={{ opacity: 0.5 }} />
      <text x="88" y="10" fill="#007AE5" fontFamily="system-ui" fontSize="7" style={{ opacity: 0.6 }}>35 m</text>
      <line x1="192" y1="20" x2="192" y2="155" stroke="#007AE5" strokeWidth="0.75" strokeDasharray="3 2" style={{ opacity: 0.4 }} />
      <line x1="189" y1="20" x2="195" y2="20" stroke="#007AE5" strokeWidth="0.75" style={{ opacity: 0.4 }} />
      <line x1="189" y1="155" x2="195" y2="155" stroke="#007AE5" strokeWidth="0.75" style={{ opacity: 0.4 }} />
      <text x="193" y="92" fill="#007AE5" fontFamily="system-ui" fontSize="7" style={{ opacity: 0.5 }}>70 m</text>
      <rect x="70" y="72" width="70" height="43" fill="#007AE5" stroke="#007AE540" strokeWidth="0.75" style={{ opacity: 0.06 }} />
    </svg>
  );
}

function StepViewerIcon() {
  return (
    <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "200px", height: "auto", flexShrink: 0 }}>
      <path d="M0 170 L60 40 L200 40 L200 170 Z" fill="#083E6F" style={{ opacity: 0.03 }} />
      <line x1="30" y1="140" x2="180" y2="80" stroke="#083E6F" strokeWidth="1.5" style={{ opacity: 0.08 }} />
      <line x1="90" y1="170" x2="120" y2="55" stroke="#083E6F" style={{ opacity: 0.06 }} />
      <line x1="10" y1="115" x2="160" y2="60" stroke="#083E6F" strokeWidth="0.75" style={{ opacity: 0.05 }} />
      <circle cx="40" cy="85" r="3" fill="#083E6F" style={{ opacity: 0.06 }} />
      <circle cx="48" cy="82" r="2.5" fill="#083E6F" style={{ opacity: 0.05 }} />
      <circle cx="44" cy="90" r="2" fill="#083E6F" style={{ opacity: 0.04 }} />
      <circle cx="165" cy="55" r="2.5" fill="#083E6F" style={{ opacity: 0.05 }} />
      <circle cx="172" cy="58" r="3" fill="#083E6F" style={{ opacity: 0.06 }} />
      <circle cx="160" cy="62" r="2" fill="#083E6F" style={{ opacity: 0.04 }} />
      <circle cx="55" cy="130" r="2.5" fill="#083E6F" style={{ opacity: 0.05 }} />
      <circle cx="62" cy="126" r="3" fill="#083E6F" style={{ opacity: 0.06 }} />
      <circle cx="175" cy="110" r="2" fill="#083E6F" style={{ opacity: 0.04 }} />
      <circle cx="180" cy="105" r="2.5" fill="#083E6F" style={{ opacity: 0.05 }} />
      <path d="M70 130 L85 85 L130 85 L125 135 Z" fill="#007AE5" stroke="#007AE559" style={{ opacity: 0.1 }} />
      <path d="M125 135 L130 85 L170 82 L172 130 Z" fill="#2D9D6E" stroke="#2D9D6E4D" strokeWidth="0.75" style={{ opacity: 0.08 }} />
      <path d="M85 85 L95 60 L130 58 L130 85 Z" fill="#B8943E" stroke="#B8943E4D" strokeWidth="0.75" style={{ opacity: 0.1 }} />
      <path d="M95 60 L102 42 L128 40 L130 58 Z" fill="#B8943E" stroke="#B8943E40" strokeWidth="0.75" style={{ opacity: 0.08 }} />
      <circle cx="103" cy="112" r="7" fill="#083E6F" style={{ opacity: 0.7 }} />
      <text x="100" y="115" fill="#F5F4DF" fontFamily="system-ui" fontSize="8" fontWeight="600">1</text>
      <circle cx="152" cy="110" r="6" fill="#083E6F" style={{ opacity: 0.6 }} />
      <text x="149.5" y="113" fill="#F5F4DF" fontFamily="system-ui" fontSize="7" fontWeight="600">2</text>
      <circle cx="112" cy="73" r="6" fill="#083E6F" style={{ opacity: 0.6 }} />
      <text x="109.5" y="76" fill="#F5F4DF" fontFamily="system-ui" fontSize="7" fontWeight="600">3</text>
      <circle cx="115" cy="50" r="5.5" fill="#083E6F" style={{ opacity: 0.55 }} />
      <text x="112.5" y="53" fill="#F5F4DF" fontFamily="system-ui" fontSize="7" fontWeight="600">4</text>
      <path d="M0 160 Q40 152 80 155 Q120 148 160 153 Q180 150 200 155 L200 170 L0 170 Z" fill="#B8943E" stroke="#B8943E1A" strokeWidth="0.5" style={{ opacity: 0.06 }} />
      <path d="M15 50 Q60 8 140 12" fill="none" stroke="#007AE540" strokeWidth="0.6" strokeDasharray="3 2" />
      <circle cx="140" cy="12" r="5" fill="#007AE5" stroke="#007AE540" strokeWidth="0.5" style={{ opacity: 0.08 }} />
      <circle cx="140" cy="12" r="2" fill="#007AE5" style={{ opacity: 0.2 }} />
      <rect x="24" y="100" width="5" height="3" fill="#083E6F" transform="rotate(-15 24 100)" style={{ opacity: 0.08 }} />
      <rect x="32" y="97" width="4" height="3" fill="#083E6F" transform="rotate(-15 32 97)" style={{ opacity: 0.07 }} />
      <rect x="28" y="105" width="3" height="2.5" fill="#083E6F" transform="rotate(-15 28 105)" style={{ opacity: 0.06 }} />
      <rect x="36" y="102" width="4.5" height="2.5" fill="#083E6F" transform="rotate(-15 36 102)" style={{ opacity: 0.07 }} />
    </svg>
  );
}

function StepShareIcon() {
  return (
    <svg viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: "200px", height: "auto", flexShrink: 0 }}>
      <rect x="5" y="22" width="115" height="78" rx="4" stroke="#083E6F" fill="#083E6F08" style={{ opacity: 0.25 }} />
      <rect x="12" y="30" width="101" height="62" rx="1" stroke="#083E6F" strokeWidth="0.5" fill="none" style={{ opacity: 0.1 }} />
      <line x1="-3" y1="102" x2="128" y2="102" stroke="#083E6F" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0.2 }} />
      <path d="M14 90 L35 35 L110 35 L110 90 Z" fill="#083E6F" style={{ opacity: 0.025 }} />
      <path d="M42 78 L50 55 L72 55 L70 80 Z" fill="#007AE5" stroke="#007AE54D" strokeWidth="0.5" style={{ opacity: 0.1 }} />
      <path d="M70 80 L72 55 L92 53 L93 78 Z" fill="#2D9D6E" stroke="#2D9D6E40" strokeWidth="0.5" style={{ opacity: 0.07 }} />
      <path d="M50 55 L55 42 L72 41 L72 55 Z" fill="#B8943E" stroke="#B8943E40" strokeWidth="0.5" style={{ opacity: 0.08 }} />
      <circle cx="58" cy="68" r="3.5" fill="#083E6F" style={{ opacity: 0.6 }} />
      <text x="56.5" y="70" fill="#F5F4DF" fontFamily="system-ui" fontSize="4" fontWeight="600">1</text>
      <circle cx="82" cy="67" r="3" fill="#083E6F" style={{ opacity: 0.5 }} />
      <text x="80.5" y="69.5" fill="#F5F4DF" fontFamily="system-ui" fontSize="4" fontWeight="600">2</text>
      <circle cx="63" cy="49" r="2.5" fill="#083E6F" style={{ opacity: 0.5 }} />
      <text x="61.5" y="51.5" fill="#F5F4DF" fontFamily="system-ui" fontSize="3.5" fontWeight="600">3</text>
      <line x1="25" y1="82" x2="100" y2="52" stroke="#083E6F" strokeWidth="0.75" style={{ opacity: 0.06 }} />
      <circle cx="30" cy="58" r="1.5" fill="#083E6F" style={{ opacity: 0.05 }} />
      <circle cx="95" cy="44" r="1.5" fill="#083E6F" style={{ opacity: 0.04 }} />
      <path d="M14 87 Q40 84 70 86 Q90 83 110 86 L110 90 L14 90 Z" fill="#B8943E" style={{ opacity: 0.04 }} />
      <rect x="18" y="33" width="55" height="5" rx="2.5" fill="#007AE5" stroke="#007AE526" strokeWidth="0.4" style={{ opacity: 0.05 }} />
      <text x="22" y="37" fill="#007AE5" fontFamily="system-ui" fontSize="3.5" style={{ opacity: 0.4 }}>parcelpin.com/v/lot-42</text>
      <rect x="142" y="35" width="48" height="84" rx="6" stroke="#083E6F" fill="#083E6F08" style={{ opacity: 0.25 }} />
      <rect x="148" y="46" width="36" height="58" rx="1" stroke="#083E6F" strokeWidth="0.5" fill="none" style={{ opacity: 0.1 }} />
      <rect x="158" y="38" width="14" height="3" rx="1.5" fill="#083E6F" style={{ opacity: 0.08 }} />
      <path d="M150 100 L157 55 L181 55 L181 100 Z" fill="#083E6F" style={{ opacity: 0.02 }} />
      <path d="M158 90 L162 70 L174 70 L173 92 Z" fill="#007AE5" stroke="#007AE54D" strokeWidth="0.4" style={{ opacity: 0.1 }} />
      <path d="M173 92 L174 70 L182 69 L182 90 Z" fill="#2D9D6E" stroke="#2D9D6E40" strokeWidth="0.4" style={{ opacity: 0.07 }} />
      <path d="M162 70 L164 60 L174 59 L174 70 Z" fill="#B8943E" stroke="#B8943E40" strokeWidth="0.4" style={{ opacity: 0.08 }} />
      <circle cx="167" cy="82" r="2.5" fill="#083E6F" style={{ opacity: 0.55 }} />
      <text x="165.5" y="84.5" fill="#F5F4DF" fontFamily="system-ui" fontSize="3.5" fontWeight="600">1</text>
      <path d="M150 97 Q165 95 181 97 L181 100 L150 100 Z" fill="#B8943E" style={{ opacity: 0.04 }} />
      <path d="M120 65 Q132 50 142 65" fill="none" stroke="#007AE5" strokeWidth="0.75" strokeDasharray="3 2" style={{ opacity: 0.35 }} />
      <circle cx="132" cy="55" r="7" fill="#007AE5" stroke="#007AE540" strokeWidth="0.6" style={{ opacity: 0.07 }} />
      <path d="M128.5 53 Q128.5 50.5 131 50.5 L133 50.5 Q135.5 50.5 135.5 53" fill="none" stroke="#007AE5" strokeLinecap="round" style={{ opacity: 0.45 }} />
      <path d="M128.5 57 Q128.5 59.5 131 59.5 L133 59.5 Q135.5 59.5 135.5 57" fill="none" stroke="#007AE5" strokeLinecap="round" style={{ opacity: 0.45 }} />
      <text x="30" y="118" fill="#083E6F" fontFamily="system-ui" fontSize="6" style={{ opacity: 0.15 }}>Any device</text>
      <text x="150" y="132" fill="#083E6F" fontFamily="system-ui" fontSize="6" style={{ opacity: 0.15 }}>No app</text>
    </svg>
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
