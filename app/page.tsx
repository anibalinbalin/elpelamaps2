"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";

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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "24px 40px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "20px",
                fontWeight: 550,
                letterSpacing: "-0.4px",
                color: "#fff",
              }}
            >
              Parcel Pin
            </span>
            <a
              href="mailto:anibalin@gmail.com?subject=Parcel Pin"
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

      {/* ── Feature sections on cream ── */}
      <section
        style={{
          backgroundColor: "var(--color-cream)",
          paddingTop: "120px",
        }}
      >
        <FeatureBlock
          image="/landing/card-overview.jpg"
          headline="One link per lot."
          text="Buyers orbit the terrain, check sun exposure at different hours, measure the tree line from every angle."
          cta="See it live"
          ctaHref="/viewer"
          align="left"
        />
        <FeatureBlock
          image="/landing/card-detail.jpg"
          headline="Light tells the truth."
          text="A static floor plan cannot show how morning light hits the lot. The viewer puts buyers in the landscape, at the time of day that matters."
          cta="Explore the viewer"
          ctaHref="/viewer"
          align="right"
        />
        <FeatureBlock
          image="/landing/card-selection.jpg"
          headline="Decided before Saturday."
          text="The buyer opens the link on their phone. They orbit the lot, check where the sun sets. They send it to their partner. Both already agree."
          cta="Try the demo"
          ctaHref="/viewer"
          align="left"
        />
      </section>

      {/* ── How it works ── */}
      <section
        style={{
          backgroundColor: "var(--color-cream)",
          padding: "120px 40px 160px",
        }}
      >
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "48px 32px",
            marginTop: "80px",
          }}
        >
          <Reveal delay={0}>
            <Step
              number="01"
              title="Send us your lot plan"
              description="A subdivision PDF or DWG with lot coordinates. That's all we need."
            />
          </Reveal>
          <Reveal delay={0.1}>
            <Step
              number="02"
              title="We build the viewer"
              description="Real terrain, sun path, atmosphere, and surrounding context. Ready in 48 hours."
            />
          </Reveal>
          <Reveal delay={0.2}>
            <Step
              number="03"
              title="Share one link"
              description="Buyers explore on any device. No app, no login. They arrive already decided."
            />
          </Reveal>
        </div>
      </section>

      {/* ── CTA — navy ── */}
      <section
        style={{
          backgroundColor: "var(--color-aviation-navy)",
          padding: "160px 40px 120px",
        }}
      >
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
              href="mailto:anibalin@gmail.com?subject=Parcel Pin"
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
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "32px 40px",
          backgroundColor: "var(--color-sky-blue)",
          borderTop: "1px solid rgba(245, 244, 223, 0.08)",
          flexWrap: "wrap" as const,
          gap: "16px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-text)",
            fontSize: "13px",
            fontWeight: 450,
            letterSpacing: "-0.13px",
            color: "rgba(245, 244, 223, 0.35)",
          }}
        >
          José Ignacio, Uruguay ·{" "}
          <a
            href="mailto:anibalin@gmail.com"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            anibalin@gmail.com
          </a>
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "14px",
            fontWeight: 550,
            letterSpacing: "-0.28px",
            color: "rgba(245, 244, 223, 0.25)",
          }}
        >
          Parcel Pin
        </span>
      </footer>
    </main>
  );
}

/* ── Components ── */

function FeatureBlock({
  image,
  headline,
  text,
  cta,
  ctaHref,
  align,
}: {
  image: string;
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
          minHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
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
            <Link
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
            </Link>
          </div>
        </div>
      </div>
    </div>
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
    <div
      style={{
        borderTop: "1px solid rgba(14, 22, 32, 0.1)",
        paddingTop: "32px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "16px",
          fontWeight: 550,
          letterSpacing: "-0.16px",
          color: "var(--color-sky-blue)",
        }}
      >
        {number}
      </span>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(24px, 2.5vw, 36px)",
          fontWeight: 550,
          lineHeight: 1.15,
          letterSpacing: "-0.03em",
          color: "var(--color-cockpit)",
          marginTop: "16px",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: "var(--font-text)",
          fontSize: "17px",
          fontWeight: 400,
          lineHeight: 1.45,
          letterSpacing: "-0.32px",
          color: "var(--color-cockpit)",
          opacity: 0.5,
          marginTop: "12px",
          maxWidth: "315px",
        }}
      >
        {description}
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
