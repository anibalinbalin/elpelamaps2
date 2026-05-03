import type { Metadata } from "next";
import Link from "next/link";
import { ParcelPinLogo } from "@/components/parcelpin-logo";

export const metadata: Metadata = {
  title: "Masterplan 360 para loteos e inmobiliarias",
  description:
    "Masterplan 360 y visor 3D para loteos, barrios privados y proyectos inmobiliarios. Cada lote tiene terreno real, sol, vistas, estado comercial y un link para compartir.",
  alternates: {
    canonical: "/masterplan-360-loteos",
    languages: {
      es: "/masterplan-360-loteos",
      en: "/3d-masterplan-subdivisions",
    },
  },
  openGraph: {
    title: "Masterplan 360 para loteos e inmobiliarias",
    description:
      "Convierte un plano de loteo en una experiencia 3D interactiva para vender parcelas con menos friccion.",
    url: "https://parcelpin.com/masterplan-360-loteos",
    images: ["/landing/before-after-poster.jpg"],
  },
};

const features = [
  "Parcelas navegables con estado, precio, superficie y archivos comerciales.",
  "Terreno real, vistas, vegetacion y recorrido solar para cada lote.",
  "Links directos por lote para WhatsApp, email, portales y pauta digital.",
  "Actualizacion de disponibilidad sin rehacer el material de marketing.",
];

const comparisons = [
  {
    title: "Mas que un tour aereo",
    text: "Un recorrido 360 muestra el entorno. Parcel Pin agrega decision comercial: cada lote se puede abrir, comparar y compartir.",
  },
  {
    title: "Mas util que un plano PDF",
    text: "El comprador no interpreta curvas de nivel ni orientacion solar. Ve el terreno, la luz y el contexto desde el navegador.",
  },
  {
    title: "Listo para captar leads",
    text: "Cada experiencia puede apuntar a WhatsApp, formulario, CRM o landing de la inmobiliaria para convertir interes en consulta.",
  },
];

const useCases = [
  { href: "/use-cases/marketing-para-loteos", label: "Marketing para loteos" },
  { href: "/use-cases/software-venta-de-lotes", label: "Software venta de lotes" },
  { href: "/use-cases/visor-3d-inmobiliario", label: "Visor 3D inmobiliario" },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Parcel Pin Masterplan 360",
  serviceType: "Interactive 3D masterplan for land and subdivision sales",
  areaServed: ["Uruguay", "Chile", "Argentina", "Paraguay", "Peru", "Mexico"],
  provider: {
    "@type": "Organization",
    name: "Parcel Pin",
    url: "https://parcelpin.com",
  },
  offers: {
    "@type": "Offer",
    availability: "https://schema.org/InStock",
    url: "https://parcelpin.com/masterplan-360-loteos",
  },
};

export default function Masterplan360Page() {
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
          <Link href="/3d-masterplan-subdivisions">English</Link>
          <a href="mailto:hello@parcelpin.com?subject=Masterplan%20360%20Parcel%20Pin">
            Contacto
          </a>
        </nav>
      </header>

      <section className="seo-hero">
        <div className="seo-hero-copy">
          <p className="seo-eyebrow">Masterplan 360 para loteos</p>
          <h1>Vende parcelas con una experiencia 3D que el comprador entiende.</h1>
          <p>
            Parcel Pin convierte un plano de loteo en un visor interactivo con
            terreno real, sol, vistas, informacion comercial y un link por lote.
          </p>
          <div className="seo-actions">
            <a href="mailto:hello@parcelpin.com?subject=Masterplan%20360%20Parcel%20Pin">
              Cotizar un proyecto
            </a>
            <Link href="/viewer">Ver demo</Link>
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
          <p className="seo-eyebrow">Para inmobiliarias y desarrolladores</p>
          <h2>La pagina que responde antes de la visita al terreno.</h2>
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
        <p className="seo-eyebrow">Mas formas de encontrar Parcel Pin</p>
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
          <p className="seo-eyebrow">De plano a link comercial</p>
          <h2>Una entrega pensada para publicar, pautar y compartir.</h2>
        </div>
        <div className="seo-proof-media">
          <img src="/landing/before-map.png" alt="Plano de loteo antes de Parcel Pin" />
          <video muted loop autoPlay playsInline poster="/landing/before-after-poster.jpg">
            <source src="/landing/before-after.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      <section className="seo-cta">
        <h2>Si hoy vendes con un PDF, una imagen aerea o un recorrido 360, este es el siguiente paso.</h2>
        <a href="mailto:hello@parcelpin.com?subject=Masterplan%20360%20Parcel%20Pin">
          Enviar mi plano de loteo
        </a>
      </section>
    </main>
  );
}
