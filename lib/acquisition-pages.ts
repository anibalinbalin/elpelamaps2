export type AcquisitionPage = {
  slug: string;
  locale: "en" | "es";
  title: string;
  description: string;
  eyebrow: string;
  headline: string;
  intro: string;
  audience: string;
  sectionTitle: string;
  features: string[];
  cards: Array<{
    title: string;
    text: string;
  }>;
  proofEyebrow: string;
  proofTitle: string;
  ctaTitle: string;
  ctaLabel: string;
  ctaSubject: string;
  languageLabel: string;
  languageHref: string;
};

export const acquisitionPages: AcquisitionPage[] = [
  {
    slug: "subdivision-marketing",
    locale: "en",
    title: "Subdivision marketing with interactive 3D parcel links",
    description:
      "Subdivision marketing page for developers and real estate teams that need buyers to understand lots, sunlight, terrain, views, and availability before visiting.",
    eyebrow: "Subdivision marketing",
    headline: "Make every lot easier to understand before the first call.",
    intro:
      "Parcel Pin turns a subdivision plan into a buyer-facing 3D experience that can be used in ads, email, WhatsApp, portals, and broker follow-up.",
    audience: "For land developers and sales teams",
    sectionTitle: "A sales asset built for the full buyer journey.",
    features: [
      "One shareable link per parcel, stage, or project.",
      "Terrain, views, vegetation, and sunlight shown in the same place.",
      "Commercial information attached to the lot the buyer is considering.",
      "Clear calls to action for inquiries, WhatsApp, CRM, or broker handoff.",
    ],
    cards: [
      {
        title: "Launch campaigns faster",
        text: "Use one visual asset across paid ads, email, organic content, and sales conversations instead of preparing separate static material for every channel.",
      },
      {
        title: "Reduce explanation work",
        text: "Buyers can see orientation, slope, surroundings, and relative position without needing a salesperson to interpret a PDF.",
      },
      {
        title: "Keep interest focused",
        text: "A lot link keeps the buyer in the project context, with the next action directly attached to the parcel they are considering.",
      },
    ],
    proofEyebrow: "From marketing material to buyer tool",
    proofTitle: "Replace static plan screenshots with a link buyers can explore.",
    ctaTitle: "If your subdivision campaign still depends on flat images, upgrade the first impression.",
    ctaLabel: "Plan my subdivision launch",
    ctaSubject: "Subdivision marketing with Parcel Pin",
    languageLabel: "Español",
    languageHref: "/use-cases/marketing-para-loteos",
  },
  {
    slug: "land-sales-software",
    locale: "en",
    title: "Land sales software for interactive parcel presentations",
    description:
      "Land sales software for presenting available lots with real terrain, sunlight, parcel details, and lead-ready links.",
    eyebrow: "Land sales software",
    headline: "Give buyers the context a lot listing cannot show.",
    intro:
      "Parcel Pin helps land sales teams present parcels with terrain, sun, views, and availability in one browser-based experience.",
    audience: "For sales teams handling multiple lots",
    sectionTitle: "The lot page becomes the sales conversation.",
    features: [
      "Parcel-by-parcel presentation for available and reserved lots.",
      "Browser-based access with no app, login, or installation.",
      "Visual context for slope, orientation, tree lines, roads, and surroundings.",
      "Demo links that brokers can share during or after each buyer conversation.",
    ],
    cards: [
      {
        title: "Shorter sales cycles",
        text: "A buyer can compare options at home before scheduling the site visit, so the visit starts with better intent.",
      },
      {
        title: "Better remote qualification",
        text: "Out-of-town buyers can understand the land before committing travel time or asking the team for repeated screenshots.",
      },
      {
        title: "Cleaner follow-up",
        text: "Sales teams can send the exact lot link being discussed instead of a general brochure or full project PDF.",
      },
    ],
    proofEyebrow: "From listing to interactive context",
    proofTitle: "Show the land details that usually get lost in a spreadsheet.",
    ctaTitle: "Turn your available lots into links buyers can act on.",
    ctaLabel: "Set up a land sales demo",
    ctaSubject: "Land sales software with Parcel Pin",
    languageLabel: "Español",
    languageHref: "/use-cases/software-venta-de-lotes",
  },
  {
    slug: "real-estate-3d-viewer",
    locale: "en",
    title: "Real estate 3D viewer for land and parcel projects",
    description:
      "A real estate 3D viewer for land, subdivisions, and parcel projects with terrain, sunlight, parcel data, and shareable buyer links.",
    eyebrow: "Real estate 3D viewer",
    headline: "A viewer built for land, not just buildings.",
    intro:
      "Most real estate 3D tools focus on interiors. Parcel Pin is designed for land: parcels, terrain, access, sunlight, and the surrounding landscape.",
    audience: "For land-first real estate projects",
    sectionTitle: "Show the factors that decide whether a lot feels right.",
    features: [
      "Terrain-aware viewing for parcels and surrounding context.",
      "Sun and time controls so buyers can understand exposure.",
      "Lot overlays that keep commercial details tied to the visual scene.",
      "Mobile-friendly links for prospects, brokers, partners, and investors.",
    ],
    cards: [
      {
        title: "Designed for open land",
        text: "The product surface is focused on parcel boundaries, views, sunlight, access, and landscape context rather than apartment walkthroughs.",
      },
      {
        title: "Works before construction",
        text: "Use project plans and site context before roads, homes, or amenities are fully built.",
      },
      {
        title: "Simple buyer access",
        text: "A prospect opens a link and explores in the browser, on mobile or desktop, without installing software.",
      },
    ],
    proofEyebrow: "From land plan to 3D viewer",
    proofTitle: "Give buyers a spatial answer before they ask for another image.",
    ctaTitle: "Show your land project as a 3D experience, not a static plan.",
    ctaLabel: "Build a 3D viewer",
    ctaSubject: "Real estate 3D viewer with Parcel Pin",
    languageLabel: "Español",
    languageHref: "/use-cases/visor-3d-inmobiliario",
  },
  {
    slug: "marketing-para-loteos",
    locale: "es",
    title: "Marketing para loteos con links 3D por parcela",
    description:
      "Marketing para loteos y desarrollos inmobiliarios con visor 3D, terreno real, sol, vistas, disponibilidad y links comerciales por lote.",
    eyebrow: "Marketing para loteos",
    headline: "Haz que cada lote se entienda antes de la primera llamada.",
    intro:
      "Parcel Pin convierte un plano de loteo en una experiencia 3D para usar en pauta, email, WhatsApp, portales y seguimiento comercial.",
    audience: "Para desarrolladores y equipos comerciales",
    sectionTitle: "Un activo de ventas para todo el recorrido del comprador.",
    features: [
      "Un link compartible por lote, etapa o proyecto.",
      "Terreno, vistas, vegetacion y sol en una misma experiencia.",
      "Informacion comercial unida al lote que el comprador esta mirando.",
      "Acciones directas hacia WhatsApp, formulario, CRM o asesor comercial.",
    ],
    cards: [
      {
        title: "Mejor pauta digital",
        text: "La campaña puede enviar al comprador a una experiencia concreta del proyecto, no solamente a una imagen o brochure general.",
      },
      {
        title: "Menos explicacion manual",
        text: "El comprador ve orientacion, pendiente, entorno y posicion relativa sin pedir que alguien le interprete el plano.",
      },
      {
        title: "Mas consultas utiles",
        text: "El interes llega conectado al lote exacto que el comprador ya reviso, comparo y compartio.",
      },
    ],
    proofEyebrow: "De material de marketing a herramienta de compra",
    proofTitle: "Cambia capturas estaticas por un link que el comprador puede explorar.",
    ctaTitle: "Si tu campana de loteo depende de imagenes planas, mejora la primera impresion.",
    ctaLabel: "Planificar mi lanzamiento",
    ctaSubject: "Marketing para loteos con Parcel Pin",
    languageLabel: "English",
    languageHref: "/use-cases/subdivision-marketing",
  },
  {
    slug: "software-venta-de-lotes",
    locale: "es",
    title: "Software para venta de lotes con presentacion interactiva",
    description:
      "Software para venta de lotes con presentacion interactiva de parcelas, terreno real, sol, vistas, disponibilidad y links para compradores.",
    eyebrow: "Software para venta de lotes",
    headline: "Dale al comprador el contexto que una ficha no puede mostrar.",
    intro:
      "Parcel Pin ayuda a equipos comerciales a presentar lotes con terreno, sol, vistas y disponibilidad en una experiencia web compartible.",
    audience: "Para equipos que venden multiples lotes",
    sectionTitle: "La ficha del lote se convierte en conversacion comercial.",
    features: [
      "Presentacion lote por lote para unidades disponibles o reservadas.",
      "Acceso web sin app, login ni instalacion.",
      "Contexto visual para pendiente, orientacion, arboles, caminos y entorno.",
      "Links que los asesores pueden compartir durante o despues de la conversacion.",
    ],
    cards: [
      {
        title: "Ciclos mas cortos",
        text: "El comprador compara opciones antes de visitar el terreno, por lo que llega con una decision mas avanzada.",
      },
      {
        title: "Mejor venta remota",
        text: "Compradores de otra ciudad pueden entender el proyecto antes de viajar o pedir nuevas imagenes al equipo.",
      },
      {
        title: "Seguimiento mas claro",
        text: "El asesor envia el link exacto del lote conversado en lugar de un PDF general del proyecto.",
      },
    ],
    proofEyebrow: "De listado a contexto interactivo",
    proofTitle: "Muestra los detalles del terreno que se pierden en una planilla.",
    ctaTitle: "Convierte tus lotes disponibles en links que el comprador puede usar.",
    ctaLabel: "Preparar una demo comercial",
    ctaSubject: "Software para venta de lotes con Parcel Pin",
    languageLabel: "English",
    languageHref: "/use-cases/land-sales-software",
  },
  {
    slug: "visor-3d-inmobiliario",
    locale: "es",
    title: "Visor 3D inmobiliario para terrenos y loteos",
    description:
      "Visor 3D inmobiliario para terrenos, loteos y proyectos de parcelas con terreno real, sol, datos comerciales y links compartibles.",
    eyebrow: "Visor 3D inmobiliario",
    headline: "Un visor hecho para vender tierra, no solo edificios.",
    intro:
      "La mayoria de los tours 3D se enfocan en interiores. Parcel Pin esta pensado para terrenos: parcelas, relieve, accesos, sol y paisaje.",
    audience: "Para proyectos inmobiliarios de tierra",
    sectionTitle: "Muestra los factores que deciden si un lote se siente correcto.",
    features: [
      "Vista con terreno y contexto alrededor del proyecto.",
      "Control de sol y horario para entender orientacion y sombra.",
      "Capas de lotes con informacion comercial dentro de la escena.",
      "Links moviles para compradores, brokers, socios e inversores.",
    ],
    cards: [
      {
        title: "Pensado para tierra abierta",
        text: "La experiencia se enfoca en limites de parcela, vistas, sol, accesos y paisaje, no en recorridos de departamentos.",
      },
      {
        title: "Sirve antes de construir",
        text: "Puedes mostrar planes, caminos, etapas y contexto del sitio antes de que el proyecto este completo.",
      },
      {
        title: "Acceso simple",
        text: "El comprador abre un link y explora desde el navegador, en telefono o escritorio, sin instalar nada.",
      },
    ],
    proofEyebrow: "De plano a visor 3D",
    proofTitle: "Dale una respuesta espacial antes de que pida otra imagen.",
    ctaTitle: "Muestra tu proyecto de terrenos como una experiencia 3D, no como un plano estatico.",
    ctaLabel: "Crear un visor 3D",
    ctaSubject: "Visor 3D inmobiliario con Parcel Pin",
    languageLabel: "English",
    languageHref: "/use-cases/real-estate-3d-viewer",
  },
];

export function getAcquisitionPage(slug: string) {
  return acquisitionPages.find((page) => page.slug === slug);
}
