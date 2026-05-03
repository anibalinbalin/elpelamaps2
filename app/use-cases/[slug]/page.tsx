import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ParcelPinLogo } from "@/components/parcelpin-logo";
import { acquisitionPages, getAcquisitionPage } from "@/lib/acquisition-pages";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return acquisitionPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getAcquisitionPage(slug);

  if (!page) {
    return {};
  }

  return {
    title: page.title,
    description: page.description,
    alternates: {
      canonical: `/use-cases/${page.slug}`,
      languages: {
        [page.locale]: `/use-cases/${page.slug}`,
        [page.locale === "en" ? "es" : "en"]: page.languageHref,
      },
    },
    openGraph: {
      title: page.title,
      description: page.description,
      url: `https://parcelpin.com/use-cases/${page.slug}`,
      images: ["/landing/before-after-poster.jpg"],
    },
  };
}

export default async function UseCasePage({ params }: PageProps) {
  const { slug } = await params;
  const page = getAcquisitionPage(slug);

  if (!page) {
    notFound();
  }

  const contactHref = `mailto:hello@parcelpin.com?subject=${encodeURIComponent(page.ctaSubject)}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: page.title,
    serviceType: page.eyebrow,
    provider: {
      "@type": "Organization",
      name: "Parcel Pin",
      url: "https://parcelpin.com",
    },
    url: `https://parcelpin.com/use-cases/${page.slug}`,
  };

  return (
    <main className="seo-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="seo-nav">
        <Link href="/" aria-label="Parcel Pin home">
          <ParcelPinLogo size="header" tone="bright" />
        </Link>
        <nav>
          <Link href="/viewer">Demo</Link>
          <Link href={page.languageHref}>{page.languageLabel}</Link>
          <a href={contactHref}>{page.locale === "en" ? "Contact" : "Contacto"}</a>
        </nav>
      </header>

      <section className="seo-hero">
        <div className="seo-hero-copy">
          <p className="seo-eyebrow">{page.eyebrow}</p>
          <h1>{page.headline}</h1>
          <p>{page.intro}</p>
          <div className="seo-actions">
            <a href={contactHref}>{page.ctaLabel}</a>
            <Link href="/viewer">{page.locale === "en" ? "View demo" : "Ver demo"}</Link>
          </div>
        </div>
        <div className="seo-hero-media" aria-label="Parcel Pin demo preview">
          <video autoPlay muted loop playsInline poster="/landing/hero-poster.jpg">
            <source src="/landing/hero.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      <section className="seo-section seo-grid">
        <div>
          <p className="seo-eyebrow">{page.audience}</p>
          <h2>{page.sectionTitle}</h2>
        </div>
        <ul className="seo-feature-list">
          {page.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section className="seo-section">
        <div className="seo-card-grid">
          {page.cards.map((item) => (
            <article key={item.title} className="seo-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-section seo-proof">
        <div>
          <p className="seo-eyebrow">{page.proofEyebrow}</p>
          <h2>{page.proofTitle}</h2>
        </div>
        <div className="seo-proof-media">
          <img
            src="/landing/before-map.png"
            alt={page.locale === "en" ? "Subdivision plan before Parcel Pin" : "Plano de loteo antes de Parcel Pin"}
          />
          <video muted loop autoPlay playsInline poster="/landing/before-after-poster.jpg">
            <source src="/landing/before-after.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      <section className="seo-cta">
        <h2>{page.ctaTitle}</h2>
        <a href={contactHref}>{page.ctaLabel}</a>
      </section>
    </main>
  );
}
