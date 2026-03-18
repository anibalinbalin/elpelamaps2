# El Pela — Real Estate Parcel Viewer MVP

## Overview

A premium, immersive 3D parcel viewer for a real estate company in José Ignacio, Uruguay. Buyers receive a link and explore available land parcels on a photorealistic 3D globe with floating detail cards.

**Target user:** Prospective buyers (not internal staff).
**Deployment:** Vercel (static Next.js).
**Visual tone:** Premium/luxury dark theme with light grey floating UI elements.

## Phased Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| **1 — Viewer MVP** | Google 3D Tiles + parcel polygons + floating detail cards + clouds | This spec |
| 2 — Draw Tool | Click-to-draw polygon editor for the client to define parcels | Future |
| 3 — Gaussian Splats | Per-parcel immersive splat views blended into the 3D tile scene | Future |

This spec covers **Phase 1** only.

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | Next.js 15 (App Router) | Vercel deployment, SSR for SEO shell, client-only 3D |
| 3D Engine | Three.js via React Three Fiber (`@react-three/fiber`) | React integration, future splat blending via Spark |
| 3D Tiles | `3DTilesRendererJS` (NASA-AMMOS) | Loads Google Photorealistic 3D Tiles, built-in GeoJSON support |
| Google API | Map Tiles API (client already has this active) | Photorealistic 3D Tiles for José Ignacio terrain + imagery |
| Styling | Tailwind CSS 4 | UI overlay (cards, pills, top bar) |
| Parcel Data | GeoJSON file | Easy to edit, standard format, import/export ready |
| Clouds | Procedural GLSL shader on hemisphere mesh | Animated, no texture loading, GPU-computed |

### Why not CesiumJS?

The client already has Google Maps Platform with Map Tiles API active (15k+ requests). Three.js + 3DTilesRendererJS loads the same Google tiles while giving full rendering control for future Gaussian splat blending (Phase 3). CesiumJS would add a 3MB bundle and not leverage the client's existing investment.

### Why not Google's native `<gmp-map-3d>`?

Limited rendering control — can't add custom shaders (clouds), custom materials, or blend Gaussian splats. The native web component doesn't support the premium dark theme or the level of visual customization needed.

## UX Design

### Layout: Full-Screen Map + Floating Cards (Layout C)

The entire viewport is a 3D globe/terrain view. UI elements float on top:

```
┌─────────────────────────────────────────────────────┐
│ El Pela              José Ignacio, Uruguay  5 Parcels│  ← TopBar (gradient fade)
│                                                      │
│        ┌──────────┐                                  │
│        │Playa Brava│  (pill label)                   │
│        └──────────┘                                  │
│              ┌─────────────────┐                     │
│              │ SELECTED PARCEL │                     │
│   ╔══════╗   │ Marina Vista    │                     │
│   ║parcel║───│ 2,500 m²  Res. │  ← ParcelCard       │
│   ║ poly ║   │ USD 450,000    │    (grey, floating)  │
│   ╚══════╝   │ [Contact Agent]│                     │
│              └─────────────────┘                     │
│                                                      │
│  ┌────────────┐                              [+]     │
│  │Laguna Norte│                              [−]     │
│  └────────────┘                           ← Zoom     │
│                                          (N) Compass │
└─────────────────────────────────────────────────────┘
```

### User Flow

1. Buyer opens the shared link
2. Camera flies into José Ignacio from a globe view (animated transition)
3. Parcel polygons appear on the terrain with floating name pills
4. Procedural clouds drift across the sky
5. Buyer clicks a parcel → polygon highlights (brighter border + glow) + grey floating card appears near it
6. Card shows: parcel name, area (m²), price (USD), zoning, and a "Contact Agent" button
7. "Contact Agent" opens a mailto: or WhatsApp link (configurable per parcel)
8. Clicking elsewhere or another parcel dismisses the card
9. Buyer can orbit (drag), zoom (scroll), and pan (shift+drag) the 3D view

### Parcel Interaction States

| State | Polygon Style | UI Element |
|-------|--------------|------------|
| Default | Semi-transparent fill, subtle border (cyan/green) | Small pill label floating above |
| Hover | Brighter fill + border, slight glow | Pill label enlarges slightly |
| Selected | Bright fill, prominent glow, thicker border | Floating grey ParcelCard with details |

### Floating Card Design

- **Background:** Light grey (`rgba(240,240,240,0.95)`) with `backdrop-filter: blur(16px)`
- **Border:** `1px solid rgba(0,0,0,0.08)`, `border-radius: 12px`
- **Shadow:** `0 12px 40px rgba(0,0,0,0.4)`
- **Typography:** Dark text (`#111`), uppercase labels (`font-size: 9px, letter-spacing: 1.5px`)
- **CTA button:** Dark (`#111` background, white text, `border-radius: 6px`)
- **Position:** Anchored near the selected parcel's centroid, offset to avoid occluding the polygon

### Floating Pill Labels

- **Background:** `rgba(30,30,30,0.7)` with `backdrop-filter: blur(4px)`
- **Border:** `1px solid rgba(255,255,255,0.08)`, `border-radius: 10px`
- **Typography:** `font-size: 10px`, `color: rgba(255,255,255,0.6)`
- **Behavior:** Always visible for all parcels, positioned above polygon centroid

### TopBar

- Semi-transparent gradient fade from black at top
- Left: brand name "El Pela" (bold) + "José Ignacio, Uruguay" (subtle)
- Right: parcel count badge

### Clouds

- Procedural GLSL fragment shader on a hemisphere mesh above the scene
- Animated UV offset for slow drift (configurable wind speed/direction)
- Subtle, semi-transparent — should not obscure the terrain
- Warm-tinted to match golden hour lighting feel

## Data Model

### Parcel (GeoJSON Feature)

```typescript
interface ParcelProperties {
  id: string;              // e.g., "marina-vista"
  name: string;            // e.g., "Marina Vista"
  areaSqMeters: number;    // e.g., 2500
  priceUSD: number;        // e.g., 450000
  zoning: string;          // e.g., "Residential"
  description?: string;    // Short text
  contactUrl: string;      // mailto: or wa.me link
  color?: string;          // Override polygon color
}
```

### parcels.geojson

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "marina-vista",
        "name": "Marina Vista",
        "areaSqMeters": 2500,
        "priceUSD": 450000,
        "zoning": "Residential",
        "contactUrl": "https://wa.me/598XXXXXXXX?text=Interested%20in%20Marina%20Vista"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-54.6340, -34.8050],
          [-54.6320, -34.8050],
          [-54.6320, -34.8070],
          [-54.6340, -34.8070],
          [-54.6340, -34.8050]
        ]]
      }
    }
  ]
}
```

Five mock parcels will be placed around José Ignacio with realistic coordinates near the lighthouse, Playa Brava, Playa Mansa, and the lagoon area.

## File Structure

```
elpela2/
├── app/
│   ├── layout.tsx                → Root layout, Tailwind, meta tags
│   ├── page.tsx                  → Redirect to /viewer or landing
│   └── viewer/
│       └── page.tsx              → Dynamic import of MapViewer (ssr: false)
├── components/
│   ├── map-viewer.tsx            → R3F Canvas + 3DTilesRendererJS setup
│   ├── google-tiles-layer.tsx    → Google Photorealistic 3D Tiles loader
│   ├── parcel-layer.tsx          → Loads GeoJSON, renders polygon meshes
│   ├── parcel-card.tsx           → Floating grey detail card (HTML overlay)
│   ├── parcel-pill.tsx           → Small floating label (HTML overlay)
│   ├── cloud-layer.tsx           → Procedural cloud hemisphere + shader
│   ├── top-bar.tsx               → Brand bar overlay
│   └── camera-controller.tsx     → Orbit/zoom/pan + initial fly-in animation
├── lib/
│   ├── parcels.ts                → Load + type parcel GeoJSON
│   ├── geo-utils.ts              → WGS84 ↔ ECEF ↔ Three.js coordinate transforms
│   └── constants.ts              → Camera defaults, José Ignacio center coords
├── shaders/
│   └── clouds.ts                 → Procedural cloud shader as GLSL template literals (no loader needed)
├── data/
│   └── parcels.geojson           → 5 mock parcels in José Ignacio
├── public/
│   └── favicon.ico
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Key Technical Considerations

### SSR / Client-Only Rendering

Three.js and 3DTilesRendererJS cannot run on the server. The `viewer/page.tsx` must use `next/dynamic` with `{ ssr: false }`. The root layout can still provide SEO metadata.

### Google Maps API Key

- Stored in `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env var
- The client's existing Map Tiles API key works
- For production: HTTP referrer restrictions on the key are required (not just recommended)

### Coordinate System

Google Photorealistic 3D Tiles use ECEF (Earth-Centered, Earth-Fixed) coordinates. 3DTilesRendererJS handles the tile positioning, but parcel polygons need to be transformed from WGS84 (lat/lng) to the scene's coordinate system. The `geo-utils.ts` module handles this.

### Performance

- 3DTilesRendererJS handles LOD streaming automatically
- Parcel polygons are lightweight (5 polygons, ~20-30 vertices each)
- Cloud shader runs on GPU — minimal CPU impact
- HTML overlay elements (cards, pills) are positioned via CSS `transform` mapped from 3D world coordinates to screen space using Three.js `project()`

### Responsive Behavior

- Desktop: full experience with orbit/zoom/pan
- Tablet: same experience, touch controls
- Mobile: same floating card with `max-width: 90vw` constraint, positioned at bottom of viewport. No bottom sheet for Phase 1.

## Mock Data: 5 José Ignacio Parcels

| Name | Location | Area | Price | Zoning |
|------|----------|------|-------|--------|
| Marina Vista | Near the lighthouse (~-34.7925, -54.6335) | 2,500 m² | USD 450,000 | Residential |
| Playa Brava | Brava beach side (~-34.7890, -54.6280) | 1,800 m² | USD 320,000 | Residential |
| Laguna Norte | North of the lagoon (~-34.7830, -54.6400) | 3,200 m² | USD 580,000 | Mixed Use |
| Faro Este | East of the lighthouse (~-34.7940, -54.6300) | 2,100 m² | USD 390,000 | Residential |
| El Bosque | Wooded area inland (~-34.7870, -54.6450) | 4,500 m² | USD 420,000 | Rural Residential |

## Out of Scope (Phase 1)

- Draw-on-map polygon editor (Phase 2)
- Gaussian splat captures and viewer (Phase 3)
- User authentication / admin panel
- Database / CMS for parcel data (GeoJSON file is sufficient for 5-15 parcels)
- Search / filter parcels
- Multilingual support
- Analytics
- Ocean/water animation
- Day/night cycle / sun position
