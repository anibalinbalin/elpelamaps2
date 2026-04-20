"use client";

import { useEffect, useRef } from "react";

export function LandingImageMotion() {
  const stageRef = useRef<HTMLElement | null>(null);
  const motionRef = useRef<HTMLDivElement | null>(null);
  const pictureRef = useRef<HTMLElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const motion = motionRef.current;
    const picture = pictureRef.current;
    const img = imgRef.current;
    if (!stage || !motion || !picture || !img) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let cleanup = () => {};

    (async () => {
      const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);

      gsap.registerPlugin(ScrollTrigger);

      if (reduced) return;

      gsap.set(motion, {
        transformPerspective: 1800,
        rotateX: 32,
        yPercent: 4,
        opacity: 0.82,
        scale: 0.92,
        transformOrigin: "50% 0%",
      });
      gsap.set(picture, { borderRadius: "3.2rem" });

      const trigger = {
        trigger: stage,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.8,
      } as const;

      const tweens = [
        gsap.to(motion, {
          rotateX: 0,
          yPercent: 0,
          opacity: 1,
          scale: 1,
          ease: "none",
          scrollTrigger: trigger,
        }),
        gsap.to(img, {
          scale: 1.06,
          ease: "none",
          scrollTrigger: trigger,
        }),
        gsap.to(picture, {
          borderRadius: 0,
          ease: "none",
          scrollTrigger: trigger,
        }),
      ];

      cleanup = () => {
        tweens.forEach((t) => {
          t.scrollTrigger?.kill();
          t.kill();
        });
      };
    })();

    return () => cleanup();
  }, []);

  return (
    <section
      ref={stageRef}
      id="image-motion"
      aria-label="Scroll image transition"
      className="image-stage relative"
      style={{
        minHeight: "200svh",
        padding: "4svh 0 28svh",
        background:
          "radial-gradient(circle at top, rgba(255,255,255,0.08), transparent 42%), linear-gradient(180deg, #050505 0%, #000 100%)",
      }}
    >
      <div
        ref={motionRef}
        className="image-motion"
        style={{
          position: "sticky",
          top: "12svh",
          width: "100vw",
          marginLeft: "calc(50% - 50vw)",
          perspective: "180rem",
          transformOrigin: "50% 0%",
          willChange: "transform, opacity",
        }}
      >
        <picture
          ref={pictureRef}
          style={{
            display: "block",
            width: "100%",
            borderRadius: "3.2rem",
            overflow: "hidden",
            boxShadow:
              "0 3.2rem 10rem rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src="https://i.postimg.cc/1ztkf4hX/moveimage.png"
            alt="Parcel Pin experience"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              objectFit: "cover",
            }}
          />
        </picture>
      </div>
    </section>
  );
}
