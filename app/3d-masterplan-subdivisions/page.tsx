import type { Metadata } from "next";
import Link from "next/link";
import { ParcelPinLogo } from "@/components/parcelpin-logo";

export const metadata: Metadata = {
  title: "3D masterplan for subdivisions and land sales",
  description:
    "Interactive 3D masterplan software for subdivisions, land developers, and real estate teams. Let buyers explore parcels, terrain, sunlight, availability, and views from one shareable link.",
  alternates: {
    canonical: "/3d-masterplan-subdivisions",
    languages: {
      en: "/3d-masterplan-subdivisions",
      es: "/masterplan-360-loteos",
    },
  },
  openGraph: {
    title: "3D masterplan for subdivisions and land sales",
    description:
      "Turn a subdivision plan into a buyer-ready 3D experience with real terrain, sunlight, parcel data, and lead-ready links.",
    url: "https://parcelpin.com/3d-masterplan-subdivisions",
    images: ["/landing/before-after-poster.jpg"],
  },
};

const features = [
  "Interactive parcels with availability, price, lot size, files, and sales notes.",
  "Real terrain, views, vegetation, and sun movement for each individual lot.",
  "Direct lot links for email, WhatsApp, paid ads, portals, and sales follow-up.",
  "Project updates without rebuilding your entire marketing package.",
];

const comparisons = [
  {
    title: "More useful than an aerial tour",
    text: "A 360 tour shows the surroundings. Parcel Pin adds the decision layer: every lot can be opened, compared, and shared.",
  },
  {
    title: "Clearer than a PDF plan",
    text: "Buyers do not need to interpret contour lines or solar orientation. They can see the land, light, and context in the browser.",
  },
  {
    title: "Ready for lead capture",
    text: "Each experience can point to WhatsApp, a form, your CRM, or the real estate team’s landing page.",
  },
];

const useCases = [
  { href: "/use-cases/subdivision-marketing", label: "Subdivision marketing" },
  { href: "/use-cases/land-sales-software", label: "Land sales software" },
  { href: "/use-cases/real-estate-3d-viewer", label: "Real estate 3D viewer" },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Parcel Pin 3D Masterplan",
  serviceType: "Interactive 3D masterplan for land and subdivision sales",
  areaServed: ["Uruguay", "Chile", "Argentina", "Paraguay", "Peru", "Mexico", "United States"],
  provider: {
    "@type": "Organization",
    name: "Parcel Pin",
    url: "https://parcelpin.com",
  },
  offers: {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
    url: "https://parcelpin.com/3d-masterplan-subdivisions",
  },
};

export default function EnglishMasterplanPage() {
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
          <Link href="/masterplan-360-loteos">Español</Link>
          <a href="mailto:hello@parcelpin.com?subject=Parcel%20Pin%203D%20Masterplan">
            Contact
          </a>
        </nav>
      </header>

      <section className="seo-hero">
        <div className="seo-hero-copy">
          <p className="seo-eyebrow">3D masterplan for subdivisions</p>
          <h1>Sell land with a 3D experience buyers understand.</h1>
          <p>
            Parcel Pin turns a subdivision plan into an interactive land viewer
            with real terrain, sunlight, views, commercial details, and one
            shareable link per parcel.
          </p>
          <div className="seo-actions">
            <a href="mailto:hello@parcelpin.com?subject=Parcel%20Pin%203D%20Masterplan">
              Quote a project
            </a>
            <Link href="/viewer">View demo</Link>
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
          <p className="seo-eyebrow">For developers and real estate teams</p>
          <h2>The page that answers questions before the site visit.</h2>
        </div>
        <ul className="seo-feature-list">
          {features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>

      <section className="seo-section">
        <div className="seo-card-grid">
          {comparisons.map((item) => (
            <article key={item.title} className="seo-card">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="seo-section seo-link-section">
        <p className="seo-eyebrow">More ways clients find Parcel Pin</p>
        <div className="seo-link-row">
          {useCases.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="seo-section seo-proof">
        <div>
          <p className="seo-eyebrow">From plan to sales link</p>
          <h2>A deliverable built to publish, advertise, and share.</h2>
        </div>
        <div className="seo-proof-media">
          <img src="/landing/before-map.png" alt="Subdivision plan before Parcel Pin" />
          <video muted loop autoPlay playsInline poster="/landing/before-after-poster.jpg">
            <source src="/landing/before-after.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      <section className="seo-cta">
        <h2>If you sell land with a PDF, aerial image, or 360 tour, this is the next step.</h2>
        <a href="mailto:hello@parcelpin.com?subject=Parcel%20Pin%203D%20Masterplan">
          Send your subdivision plan
        </a>
      </section>
    </main>
  );
}
