"use client";

import "ol/ol.css";
import { useEffect, useRef, useState, useCallback } from "react";
import Map from "ol/Map";
import View from "ol/View";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { Draw, Modify, Select, Snap } from "ol/interaction";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import { click } from "ol/events/condition";
import { fromLonLat, transform } from "ol/proj";
import GeoJSON from "ol/format/GeoJSON";
import { Fill, Stroke, Style, Circle as CircleStyle } from "ol/style";
import type OLFeature from "ol/Feature";
import type OLPolygon from "ol/geom/Polygon";

import { EditorAccessDialog } from "@/components/editor-access-dialog";
import { hasEditorAccess, grantEditorAccess } from "@/lib/editor-access";
import { sphericalArea } from "@/lib/geo-area";
import { formatAreaCompact } from "@/lib/geo-utils";
import { JOSE_IGNACIO_CENTER } from "@/lib/constants";
import type { ParcelCollection, ParcelFeature } from "@/lib/parcels";
import { Input, Button } from "@/components/ui";

type OLParcelFeature = OLFeature<OLPolygon>;
type ParcelStatus = "for-sale" | "reserved" | "sold";
type SaveState = "idle" | "saving" | "saved" | "error";

interface ParcelMeta {
  id: string;
  name: string;
  status: ParcelStatus;
  priceUSD?: number;
  zoning?: string;
  contactUrl?: string;
  description?: string;
  areaSqMeters: number;
}

const geoFormat = new GeoJSON({
  dataProjection: "EPSG:4326",
  featureProjection: "EPSG:3857",
});

function getArea(f: OLParcelFeature): number {
  const coords = f.getGeometry()?.getCoordinates()[0];
  if (!coords || coords.length < 3) return 0;
  const ring = coords.map(
    ([x, y]) => transform([x, y], "EPSG:3857", "EPSG:4326") as [number, number],
  );
  return sphericalArea(ring);
}

function featureToMeta(f: OLParcelFeature): ParcelMeta {
  return {
    id: String(f.getId()),
    name: String(f.get("name") || f.getId()),
    status: (f.get("status") as ParcelStatus) || "for-sale",
    priceUSD: f.get("priceUSD") as number | undefined,
    zoning: f.get("zoning") as string | undefined,
    contactUrl: f.get("contactUrl") as string | undefined,
    description: f.get("description") as string | undefined,
    areaSqMeters: Number(f.get("areaSqMeters") || 0),
  };
}

const defaultStyle = new Style({
  fill: new Fill({ color: "rgba(255, 251, 240, 0.1)" }),
  stroke: new Stroke({ color: "rgba(255, 251, 240, 0.85)", width: 2 }),
});

const selectedStyle = new Style({
  fill: new Fill({ color: "rgba(255, 255, 255, 0.14)" }),
  stroke: new Stroke({ color: "rgba(255, 255, 255, 1)", width: 2.5 }),
  image: new CircleStyle({
    radius: 5,
    fill: new Fill({ color: "rgba(255, 255, 255, 0.95)" }),
    stroke: new Stroke({ color: "rgba(15, 20, 25, 0.75)", width: 1.5 }),
  }),
});

const drawStyle = new Style({
  fill: new Fill({ color: "rgba(255, 255, 255, 0.06)" }),
  stroke: new Stroke({
    color: "rgba(255, 255, 255, 0.65)",
    width: 2,
    lineDash: [6, 4],
  }),
  image: new CircleStyle({
    radius: 4,
    fill: new Fill({ color: "rgba(255, 255, 255, 0.75)" }),
  }),
});

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

function makeBasemap() {
  return new TileLayer({
    source: MAPBOX_TOKEN
      ? new XYZ({
          url: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`,
          tileSize: 512,
          maxZoom: 20,
        })
      : new XYZ({
          url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          maxZoom: 19,
        }),
  });
}

export function EditorV2() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const sourceRef = useRef(new VectorSource());
  const selectRef = useRef<Select | null>(null);
  const drawRef = useRef<Draw | null>(null);

  const [access, setAccess] = useState(false);
  const [mode, setMode] = useState<"select" | "draw">("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [parcels, setParcels] = useState<ParcelMeta[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [inspectorDraft, setInspectorDraft] = useState<ParcelMeta | null>(null);

  useEffect(() => {
    setAccess(hasEditorAccess());
  }, []);

  const syncParcels = useCallback(() => {
    const features = sourceRef.current.getFeatures() as OLParcelFeature[];
    setParcels(features.map(featureToMeta));
  }, []);

  const updateFeatureProps = useCallback(
    (id: string, patch: Partial<Omit<ParcelMeta, "id">>) => {
      const f = sourceRef.current.getFeatureById(id) as OLParcelFeature | null;
      if (!f) return;
      for (const [k, v] of Object.entries(patch)) f.set(k, v);
      setInspectorDraft((prev) => (prev ? { ...prev, ...patch } : prev));
      syncParcels();
    },
    [syncParcels],
  );

  const deleteParcel = useCallback(
    (id: string) => {
      const f = sourceRef.current.getFeatureById(id);
      if (f) sourceRef.current.removeFeature(f);
      selectRef.current?.getFeatures().clear();
      setSelectedId((prev) => (prev === id ? null : prev));
      setInspectorDraft((prev) => (prev?.id === id ? null : prev));
      syncParcels();
    },
    [syncParcels],
  );

  const save = useCallback(async () => {
    setSaveState("saving");
    const features = sourceRef.current.getFeatures() as OLParcelFeature[];
    const collection: ParcelCollection = {
      type: "FeatureCollection",
      features: features.map((f) => {
        const written = geoFormat.writeFeatureObject(f);
        return {
          ...written,
          properties: {
            id: String(f.getId()),
            name: String(f.get("name") || f.getId()),
            status: (f.get("status") as ParcelStatus) ?? "for-sale",
            priceUSD: f.get("priceUSD") as number | undefined,
            zoning: f.get("zoning") as string | undefined,
            contactUrl: f.get("contactUrl") as string | undefined,
            description: f.get("description") as string | undefined,
            areaSqMeters: Number(f.get("areaSqMeters") || 0),
          },
        } as ParcelFeature;
      }),
    };
    try {
      const res = await fetch("/api/parcels?mode=replace", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(collection),
      });
      setSaveState(res.ok ? "saved" : "error");
    } catch {
      setSaveState("error");
    }
    window.setTimeout(() => setSaveState("idle"), 2500);
  }, []);

  const selectParcelById = useCallback((id: string) => {
    const sel = selectRef.current;
    const f = sourceRef.current.getFeatureById(id) as OLParcelFeature | null;
    if (!sel || !f) return;
    sel.getFeatures().clear();
    sel.getFeatures().push(f);
    setSelectedId(id);
    setInspectorDraft(featureToMeta(f));
    const geom = f.getGeometry();
    if (geom) {
      mapRef.current
        ?.getView()
        .fit(geom.getExtent(), { padding: [60, 60, 60, 60], maxZoom: 18, duration: 400 });
    }
  }, []);

  // Initialize map once access is granted
  useEffect(() => {
    if (!access || !mapDivRef.current) return;

    const source = sourceRef.current;
    const select = new Select({ condition: click, style: selectedStyle });
    const modify = new Modify({ source });
    const snap = new Snap({ source });
    const draw = new Draw({ source, type: "Polygon", style: drawStyle });
    draw.setActive(false);

    selectRef.current = select;
    drawRef.current = draw;

    const map = new Map({
      target: mapDivRef.current,
      layers: [makeBasemap(), new VectorLayer({ source, style: defaultStyle, zIndex: 1 })],
      view: new View({
        center: fromLonLat([JOSE_IGNACIO_CENTER.lon, JOSE_IGNACIO_CENTER.lat]),
        zoom: 15,
        minZoom: 12,
        maxZoom: 20,
      }),
      controls: [],
      interactions: [
        ...defaultInteractions().getArray(),
        select,
        modify,
        snap,
        draw,
      ],
    });
    mapRef.current = map;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select.on("select", (e: any) => {
      const f = e.selected[0] as OLParcelFeature | undefined;
      const id = f ? String(f.getId()) : null;
      setSelectedId(id);
      setInspectorDraft(f ? featureToMeta(f) : null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modify.on("modifyend", (e: any) => {
      for (const f of e.features.getArray() as OLParcelFeature[]) {
        const area = getArea(f);
        f.set("areaSqMeters", area);
        setInspectorDraft((prev) =>
          prev?.id === String(f.getId()) ? { ...prev, areaSqMeters: area } : prev,
        );
      }
      syncParcels();
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    draw.on("drawend", (e: any) => {
      const f = e.feature as OLParcelFeature;
      const id = `parcel-${Date.now()}`;
      f.setId(id);
      f.set("name", id);
      f.set("status", "for-sale");
      f.set("areaSqMeters", getArea(f));
      syncParcels();
      setMode("select");
      window.setTimeout(() => {
        const sel = selectRef.current;
        if (!sel) return;
        sel.getFeatures().clear();
        const added = source.getFeatureById(id) as OLParcelFeature | null;
        if (added) {
          sel.getFeatures().push(added);
          setSelectedId(id);
          setInspectorDraft(featureToMeta(added));
        }
      }, 50);
    });

    fetch("/api/parcels", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ParcelCollection) => {
        const features = geoFormat.readFeatures(data) as OLParcelFeature[];
        for (const f of features) {
          const id = f.get("id") as string;
          if (id) f.setId(id);
          if (!f.get("areaSqMeters")) f.set("areaSqMeters", getArea(f));
        }
        source.addFeatures(features);
        syncParcels();
      })
      .catch(() => {});

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      selectRef.current = null;
      drawRef.current = null;
    };
  }, [access, syncParcels]);

  // Toggle interactions on mode change
  useEffect(() => {
    const sel = selectRef.current;
    const drw = drawRef.current;
    if (!sel || !drw) return;
    if (mode === "draw") {
      sel.setActive(false);
      sel.getFeatures().clear();
      setSelectedId(null);
      setInspectorDraft(null);
      drw.setActive(true);
    } else {
      drw.setActive(false);
      sel.setActive(true);
    }
  }, [mode]);

  if (!access) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0f14]">
        <EditorAccessDialog
          onSuccess={() => {
            grantEditorAccess();
            setAccess(true);
          }}
          onCancel={() => {
            window.location.href = "/viewer-v2";
          }}
        />
      </div>
    );
  }

  const saveLabel =
    saveState === "saving"
      ? "saving..."
      : saveState === "saved"
        ? "saved"
        : saveState === "error"
          ? "error"
          : "save";

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-ink)]">
      {/* Map */}
      <div ref={mapDivRef} className="flex-1" />

      {/* Sidebar */}
      <div className="flex w-80 shrink-0 flex-col border-l border-[var(--color-hairline-dark)] bg-[var(--color-ink-pane)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline-dark)] px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            parcels
          </span>
          <div className="flex overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-hairline-dark)] text-[11px] uppercase tracking-[0.12em]">
            <button
              type="button"
              onClick={() => setMode("select")}
              className={`px-3 py-1.5 transition-colors ${
                mode === "select"
                  ? "bg-white/12 text-white"
                  : "text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              select
            </button>
            <button
              type="button"
              onClick={() => setMode("draw")}
              className={`px-3 py-1.5 transition-colors ${
                mode === "draw"
                  ? "bg-white/12 text-white"
                  : "text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              draw
            </button>
          </div>
        </div>

        {/* Parcel list */}
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {parcels.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] uppercase tracking-[0.14em] text-white/25">
              no parcels · draw to add
            </div>
          ) : (
            parcels.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectParcelById(p.id)}
                className={`group flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  p.id === selectedId
                    ? "bg-[var(--color-ink-inset)] text-white"
                    : "text-white/55 hover:bg-[var(--color-ink-inset)]/60 hover:text-white/85"
                }`}
              >
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium">
                    {p.name || p.id}
                  </div>
                  <div className="mt-0.5 font-mono tabular-nums text-[10px] uppercase tracking-[0.1em] text-white/40">
                    {formatAreaCompact(p.areaSqMeters)}
                    {p.status ? ` · ${p.status}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteParcel(p.id);
                  }}
                  aria-label="Delete parcel"
                  className="invisible ml-2 shrink-0 rounded px-1.5 py-0.5 text-[12px] leading-none text-white/30 transition-colors hover:bg-white/10 hover:text-white group-hover:visible"
                >
                  ×
                </button>
              </button>
            ))
          )}
        </div>

        {/* Inspector */}
        {inspectorDraft && (
          <div className="border-t border-[var(--color-hairline-dark)] px-4 py-4">
            <div className="mb-3 text-[10px] uppercase tracking-[0.18em] text-white/40">
              inspector
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                  name
                </label>
                <Input
                  type="text"
                  value={inspectorDraft.name}
                  onChange={(e) =>
                    updateFeatureProps(inspectorDraft.id, { name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                  status
                </label>
                <div className="flex gap-1.5">
                  {(["for-sale", "reserved", "sold"] as ParcelStatus[]).map(
                    (s) => {
                      const active = inspectorDraft.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() =>
                            updateFeatureProps(inspectorDraft.id, { status: s })
                          }
                          className={`flex-1 rounded-[var(--radius-md)] border py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors ${
                            active
                              ? "border-[var(--color-hairline-strong)] bg-white/12 text-white"
                              : "border-[var(--color-hairline-dark)] text-white/45 hover:bg-white/5 hover:text-white/80"
                          }`}
                        >
                          {s === "for-sale" ? "sale" : s}
                        </button>
                      );
                    },
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                  price usd
                </label>
                <Input
                  type="number"
                  mono
                  value={inspectorDraft.priceUSD ?? ""}
                  onChange={(e) =>
                    updateFeatureProps(inspectorDraft.id, {
                      priceUSD: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="—"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                  contact url
                </label>
                <Input
                  type="text"
                  value={inspectorDraft.contactUrl ?? ""}
                  onChange={(e) =>
                    updateFeatureProps(inspectorDraft.id, {
                      contactUrl: e.target.value || undefined,
                    })
                  }
                  placeholder="wa.me/…"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                  description
                </label>
                <textarea
                  value={inspectorDraft.description ?? ""}
                  onChange={(e) =>
                    updateFeatureProps(inspectorDraft.id, {
                      description: e.target.value || undefined,
                    })
                  }
                  rows={3}
                  placeholder="Notes, highlights, access details…"
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-hairline-dark)] bg-white/[0.04] px-3 py-2 text-[13px] leading-5 text-white outline-none placeholder:text-white/30 focus:bg-white/10 focus:border-white/25"
                />
              </div>

              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                  area (m²)
                </label>
                <Input
                  type="number"
                  mono
                  step={1}
                  value={
                    Number.isFinite(inspectorDraft.areaSqMeters)
                      ? Math.round(inspectorDraft.areaSqMeters)
                      : ""
                  }
                  onChange={(e) => {
                    const next = e.target.value === "" ? 0 : Number(e.target.value);
                    updateFeatureProps(inspectorDraft.id, { areaSqMeters: next });
                  }}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-hairline-dark)] px-4 py-3">
          <a
            href="/viewer-v2"
            className="text-[11px] uppercase tracking-[0.14em] text-white/40 transition-colors hover:text-white"
          >
            ← viewer
          </a>
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            disabled={saveState === "saving"}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
