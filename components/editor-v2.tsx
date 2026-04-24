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
import MultiPoint from "ol/geom/MultiPoint";
import type OLFeature from "ol/Feature";
import type OLGeometry from "ol/geom/Geometry";
import type OLPolygon from "ol/geom/Polygon";
import type OLLineString from "ol/geom/LineString";

import { EditorAccessDialog } from "@/components/editor-access-dialog";
import { hasEditorAccess, grantEditorAccess } from "@/lib/editor-access";
import { sphericalArea } from "@/lib/geo-area";
import { formatAreaCompact } from "@/lib/geo-utils";
import { JOSE_IGNACIO_CENTER } from "@/lib/constants";
import type { ParcelCollection, FeatureType } from "@/lib/parcels";
import { Input, Button } from "@/components/ui";

type AnyFeature = OLFeature<OLGeometry>;
type ParcelStatus = "for-sale" | "reserved" | "sold";
type SaveState = "idle" | "saving" | "saved" | "error";
type EditorMode = "select" | "draw";

interface FeatureMeta {
  id: string;
  name: string;
  featureType: FeatureType;
  status: ParcelStatus;
  priceUSD?: number;
  zoning?: string;
  contactUrl?: string;
  description?: string;
  areaSqMeters: number;
  roadWidth?: number;
  smoothed?: boolean;
}

// --- Chaikin corner-cutting (smooths polygon/line edges) ---

function chaikinSmooth(coords: number[][], iterations = 3): number[][] {
  let pts = coords;
  for (let i = 0; i < iterations; i++) {
    const next: number[][] = [];
    for (let j = 0; j < pts.length - 1; j++) {
      const p0 = pts[j];
      const p1 = pts[j + 1];
      next.push([0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1]]);
      next.push([0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1]]);
    }
    pts = next;
  }
  return pts;
}

function smoothPolygonCoords(rings: number[][][]): number[][][] {
  return rings.map((ring) => {
    const open = ring.slice(0, -1);
    const smoothed = chaikinSmooth(open);
    smoothed.push(smoothed[0]);
    return smoothed;
  });
}

function smoothLineCoords(coords: number[][]): number[][] {
  return chaikinSmooth(coords);
}

// --- Styles per feature type ---

const FEATURE_STYLES: Record<FeatureType, { fill: string; stroke: string }> = {
  parcel: { fill: "rgba(255, 251, 240, 0.1)", stroke: "rgba(255, 251, 240, 0.85)" },
  road: { fill: "rgba(180, 180, 180, 0.08)", stroke: "rgba(220, 200, 160, 0.75)" },
  amenity: { fill: "rgba(129, 199, 132, 0.12)", stroke: "rgba(129, 199, 132, 0.8)" },
};

function featureStyle(f: AnyFeature): Style[] {
  const ft = (f.get("featureType") as FeatureType) || "parcel";
  const s = FEATURE_STYLES[ft];
  const isRoad = ft === "road";
  const width = isRoad ? (f.get("roadWidth") as number) || 6 : 2;
  const base = new Style({
    fill: new Fill({ color: s.fill }),
    stroke: new Stroke({
      color: s.stroke,
      width,
      lineCap: isRoad ? "round" : "butt",
      lineJoin: isRoad ? "round" : "miter",
    }),
  });
  const vertices = new Style({
    image: new CircleStyle({
      radius: 3.5,
      fill: new Fill({ color: s.stroke }),
      stroke: new Stroke({ color: "rgba(0, 0, 0, 0.4)", width: 1 }),
    }),
    geometry: (feature) => {
      const geom = feature.getGeometry();
      if (!geom) return undefined;
      let coords: number[][] = [];
      if (geom.getType() === "Polygon") {
        coords = (geom as OLPolygon).getCoordinates()[0];
      } else if (geom.getType() === "LineString") {
        coords = (geom as OLLineString).getCoordinates();
      }
      return new MultiPoint(coords);
    },
  });
  return [base, vertices];
}

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
  stroke: new Stroke({ color: "rgba(255, 255, 255, 0.65)", width: 2, lineDash: [6, 4] }),
  image: new CircleStyle({
    radius: 4,
    fill: new Fill({ color: "rgba(255, 255, 255, 0.75)" }),
  }),
});

const geoFormat = new GeoJSON({
  dataProjection: "EPSG:4326",
  featureProjection: "EPSG:3857",
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

function getArea(f: AnyFeature): number {
  const geom = f.getGeometry();
  if (!geom || geom.getType() !== "Polygon") return 0;
  const coords = (geom as OLPolygon).getCoordinates()[0];
  if (!coords || coords.length < 3) return 0;
  const ring = coords.map(
    ([x, y]) => transform([x, y], "EPSG:3857", "EPSG:4326") as [number, number],
  );
  return sphericalArea(ring);
}

function featureToMeta(f: AnyFeature): FeatureMeta {
  return {
    id: String(f.getId()),
    name: String(f.get("name") || f.getId()),
    featureType: (f.get("featureType") as FeatureType) || "parcel",
    status: (f.get("status") as ParcelStatus) || "for-sale",
    priceUSD: f.get("priceUSD") as number | undefined,
    zoning: f.get("zoning") as string | undefined,
    contactUrl: f.get("contactUrl") as string | undefined,
    description: f.get("description") as string | undefined,
    areaSqMeters: Number(f.get("areaSqMeters") || 0),
    roadWidth: f.get("roadWidth") as number | undefined,
    smoothed: f.get("smoothed") as boolean | undefined,
  };
}

const DRAW_TYPES: Record<FeatureType, "Polygon" | "LineString"> = {
  parcel: "Polygon",
  road: "LineString",
  amenity: "Polygon",
};

const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  parcel: "parcel",
  road: "road",
  amenity: "amenity",
};

export function EditorV2() {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const sourceRef = useRef(new VectorSource());
  const selectRef = useRef<Select | null>(null);
  const drawRef = useRef<Draw | null>(null);

  const [access, setAccess] = useState(false);
  const [mode, setMode] = useState<EditorMode>("select");
  const [drawType, setDrawType] = useState<FeatureType>("parcel");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureMeta[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [inspectorDraft, setInspectorDraft] = useState<FeatureMeta | null>(null);

  useEffect(() => {
    setAccess(hasEditorAccess());
  }, []);

  const syncFeatures = useCallback(() => {
    const all = sourceRef.current.getFeatures() as AnyFeature[];
    setFeatures(all.map(featureToMeta));
  }, []);

  const updateFeatureProps = useCallback(
    (id: string, patch: Partial<Omit<FeatureMeta, "id">>) => {
      const f = sourceRef.current.getFeatureById(id) as AnyFeature | null;
      if (!f) return;
      for (const [k, v] of Object.entries(patch)) f.set(k, v);
      setInspectorDraft((prev) => (prev ? { ...prev, ...patch } : prev));
      syncFeatures();
    },
    [syncFeatures],
  );

  const deleteFeature = useCallback(
    (id: string) => {
      const f = sourceRef.current.getFeatureById(id);
      if (f) sourceRef.current.removeFeature(f);
      selectRef.current?.getFeatures().clear();
      setSelectedId((prev) => (prev === id ? null : prev));
      setInspectorDraft((prev) => (prev?.id === id ? null : prev));
      syncFeatures();
    },
    [syncFeatures],
  );

  const toggleSmooth = useCallback(
    (id: string) => {
      const f = sourceRef.current.getFeatureById(id) as AnyFeature | null;
      if (!f) return;
      const geom = f.getGeometry();
      if (!geom) return;
      const isSmoothed = f.get("smoothed") as boolean;

      if (isSmoothed) {
        const original = f.get("originalCoords") as number[][][] | undefined;
        if (!original) return;
        if (geom.getType() === "Polygon") {
          (geom as OLPolygon).setCoordinates(original);
        } else if (geom.getType() === "LineString") {
          (geom as OLLineString).setCoordinates(original[0]);
        }
        f.set("smoothed", false);
        f.set("originalCoords", undefined);
      } else {
        if (geom.getType() === "Polygon") {
          const coords = (geom as OLPolygon).getCoordinates();
          f.set("originalCoords", coords);
          (geom as OLPolygon).setCoordinates(smoothPolygonCoords(coords));
        } else if (geom.getType() === "LineString") {
          const coords = (geom as OLLineString).getCoordinates();
          f.set("originalCoords", [coords]);
          (geom as OLLineString).setCoordinates(smoothLineCoords(coords));
        }
        f.set("smoothed", true);
      }
      f.set("areaSqMeters", getArea(f));
      setInspectorDraft((prev) =>
        prev?.id === id
          ? { ...prev, smoothed: !isSmoothed, areaSqMeters: getArea(f) }
          : prev,
      );
      syncFeatures();
    },
    [syncFeatures],
  );

  const save = useCallback(async () => {
    setSaveState("saving");
    const all = sourceRef.current.getFeatures() as AnyFeature[];
    const collection: ParcelCollection = {
      type: "FeatureCollection",
      features: all.map((f) => {
        const written = geoFormat.writeFeatureObject(f);
        return {
          ...written,
          properties: {
            id: String(f.getId()),
            name: String(f.get("name") || f.getId()),
            featureType: (f.get("featureType") as FeatureType) || "parcel",
            status: (f.get("status") as ParcelStatus) ?? "for-sale",
            priceUSD: f.get("priceUSD") as number | undefined,
            zoning: f.get("zoning") as string | undefined,
            contactUrl: f.get("contactUrl") as string | undefined,
            description: f.get("description") as string | undefined,
            areaSqMeters: Number(f.get("areaSqMeters") || 0),
            roadWidth: f.get("roadWidth") as number | undefined,
            smoothed: f.get("smoothed") as boolean | undefined,
            originalCoords: f.get("originalCoords") as number[][][] | undefined,
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;
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

  const selectFeatureById = useCallback((id: string) => {
    const sel = selectRef.current;
    const f = sourceRef.current.getFeatureById(id) as AnyFeature | null;
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

  // --- Recreate draw interaction when drawType changes ---
  const recreateDraw = useCallback(
    (map: Map, geomType: "Polygon" | "LineString") => {
      const old = drawRef.current;
      if (old) {
        map.removeInteraction(old);
      }
      const draw = new Draw({
        source: sourceRef.current,
        type: geomType,
        style: drawStyle,
      });
      draw.setActive(mode === "draw");
      drawRef.current = draw;
      map.addInteraction(draw);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      draw.on("drawend", (e: any) => {
        const f = e.feature as AnyFeature;
        const ft = drawType;
        const id = `${ft}-${Date.now()}`;
        f.setId(id);
        f.set("name", id);
        f.set("featureType", ft);
        f.set("status", ft === "parcel" ? "for-sale" : undefined);
        f.set("areaSqMeters", getArea(f));
        if (ft === "road") f.set("roadWidth", 6);
        syncFeatures();
        setMode("select");
        window.setTimeout(() => {
          const sel = selectRef.current;
          if (!sel) return;
          sel.getFeatures().clear();
          const added = sourceRef.current.getFeatureById(id) as AnyFeature | null;
          if (added) {
            sel.getFeatures().push(added);
            setSelectedId(id);
            setInspectorDraft(featureToMeta(added));
          }
        }, 50);
      });

      return draw;
    },
    [mode, drawType, syncFeatures],
  );

  // Initialize map
  useEffect(() => {
    if (!access || !mapDivRef.current) return;

    const source = sourceRef.current;
    const select = new Select({ condition: click, style: selectedStyle });
    const modify = new Modify({ source });
    const snap = new Snap({ source });

    selectRef.current = select;

    const map = new Map({
      target: mapDivRef.current,
      layers: [
        makeBasemap(),
        new VectorLayer({
          source,
          style: (f) => featureStyle(f as AnyFeature),
          zIndex: 1,
        }),
      ],
      view: new View({
        center: fromLonLat([JOSE_IGNACIO_CENTER.lon, JOSE_IGNACIO_CENTER.lat]),
        zoom: 15,
        minZoom: 12,
        maxZoom: 20,
      }),
      controls: [],
      interactions: [...defaultInteractions().getArray(), select, modify, snap],
    });
    mapRef.current = map;

    recreateDraw(map, DRAW_TYPES[drawType]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select.on("select", (e: any) => {
      const f = e.selected[0] as AnyFeature | undefined;
      const id = f ? String(f.getId()) : null;
      setSelectedId(id);
      setInspectorDraft(f ? featureToMeta(f) : null);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    modify.on("modifyend", (e: any) => {
      for (const f of e.features.getArray() as AnyFeature[]) {
        if (f.get("smoothed")) {
          f.set("smoothed", false);
          f.set("originalCoords", undefined);
        }
        const area = getArea(f);
        f.set("areaSqMeters", area);
        setInspectorDraft((prev) =>
          prev?.id === String(f.getId())
            ? { ...prev, areaSqMeters: area, smoothed: false }
            : prev,
        );
      }
      syncFeatures();
    });

    fetch("/api/parcels", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ParcelCollection) => {
        const loaded = geoFormat.readFeatures(data) as AnyFeature[];
        for (const f of loaded) {
          const id = f.get("id") as string;
          if (id) f.setId(id);
          if (!f.get("featureType")) f.set("featureType", "parcel");
          if (!f.get("areaSqMeters")) f.set("areaSqMeters", getArea(f));
        }
        source.addFeatures(loaded);
        syncFeatures();
      })
      .catch(() => {});

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      selectRef.current = null;
      drawRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [access]);

  // Recreate draw when drawType changes (after map init)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    recreateDraw(map, DRAW_TYPES[drawType]);
  }, [drawType, recreateDraw]);

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
            window.location.href = "/viewer";
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

  const parcels = features.filter((f) => f.featureType === "parcel");
  const roads = features.filter((f) => f.featureType === "road");
  const amenities = features.filter((f) => f.featureType === "amenity");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--color-ink)]">
      {/* Map */}
      <div ref={mapDivRef} className="flex-1" />

      {/* Sidebar */}
      <div className="flex w-80 shrink-0 flex-col border-l border-[var(--color-hairline-dark)] bg-[var(--color-ink-pane)]">
        {/* Header / Mode */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline-dark)] px-4 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            editor
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

        {/* Draw type selector (visible in draw mode) */}
        {mode === "draw" && (
          <div className="border-b border-[var(--color-hairline-dark)] px-4 py-3">
            <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/40">
              draw type
            </div>
            <div className="flex gap-1.5">
              {(["parcel", "road", "amenity"] as FeatureType[]).map((ft) => (
                <button
                  key={ft}
                  type="button"
                  onClick={() => setDrawType(ft)}
                  className={`flex-1 rounded-[var(--radius-md)] border py-1.5 text-[10px] uppercase tracking-[0.1em] transition-colors ${
                    drawType === ft
                      ? "border-[var(--color-hairline-strong)] bg-white/12 text-white"
                      : "border-[var(--color-hairline-dark)] text-white/45 hover:bg-white/5 hover:text-white/80"
                  }`}
                >
                  {FEATURE_TYPE_LABELS[ft]}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[10px] text-white/30">
              {drawType === "parcel" && "Click to place vertices, double-click to close."}
              {drawType === "road" && "Click to place points, double-click to finish."}
              {drawType === "amenity" && "Draw area polygon, use smooth after."}
            </div>
          </div>
        )}

        {/* Feature list */}
        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {features.length === 0 ? (
            <div className="px-4 py-8 text-center text-[11px] uppercase tracking-[0.14em] text-white/25">
              no features · draw to add
            </div>
          ) : (
            <>
              {parcels.length > 0 && (
                <FeatureGroup
                  label="Parcels"
                  items={parcels}
                  selectedId={selectedId}
                  onSelect={selectFeatureById}
                  onDelete={deleteFeature}
                />
              )}
              {roads.length > 0 && (
                <FeatureGroup
                  label="Roads"
                  items={roads}
                  selectedId={selectedId}
                  onSelect={selectFeatureById}
                  onDelete={deleteFeature}
                />
              )}
              {amenities.length > 0 && (
                <FeatureGroup
                  label="Amenities"
                  items={amenities}
                  selectedId={selectedId}
                  onSelect={selectFeatureById}
                  onDelete={deleteFeature}
                />
              )}
            </>
          )}
        </div>

        {/* Inspector */}
        {inspectorDraft && (
          <div className="border-t border-[var(--color-hairline-dark)] px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                inspector
              </span>
              <span
                className="rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider"
                style={{
                  color: FEATURE_STYLES[inspectorDraft.featureType].stroke,
                  background: FEATURE_STYLES[inspectorDraft.featureType].fill,
                }}
              >
                {inspectorDraft.featureType}
              </span>
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

              {inspectorDraft.featureType === "parcel" && (
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                    status
                  </label>
                  <div className="flex gap-1.5">
                    {(["for-sale", "reserved", "sold"] as ParcelStatus[]).map((s) => {
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
                    })}
                  </div>
                </div>
              )}

              {inspectorDraft.featureType === "parcel" && (
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
              )}

              {inspectorDraft.featureType === "road" && (
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-white/45">
                    road width (px)
                  </label>
                  <Input
                    type="number"
                    mono
                    value={inspectorDraft.roadWidth ?? 6}
                    onChange={(e) =>
                      updateFeatureProps(inspectorDraft.id, {
                        roadWidth: e.target.value ? Number(e.target.value) : 6,
                      })
                    }
                    placeholder="6"
                  />
                </div>
              )}

              {inspectorDraft.featureType !== "road" && (
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
              )}

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
                  rows={2}
                  placeholder="Notes..."
                  className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-hairline-dark)] bg-white/[0.04] px-3 py-2 text-[13px] leading-5 text-white outline-none placeholder:text-white/30 focus:border-white/25 focus:bg-white/10"
                />
              </div>

              {/* Smooth toggle */}
              <button
                type="button"
                onClick={() => toggleSmooth(inspectorDraft.id)}
                className={`w-full rounded-[var(--radius-md)] border py-2 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  inspectorDraft.smoothed
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : "border-[var(--color-hairline-dark)] text-white/50 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                {inspectorDraft.smoothed ? "✓ smoothed — click to undo" : "smooth edges"}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--color-hairline-dark)] px-4 py-3">
          <a
            href="/viewer"
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

// --- Feature group component ---

function FeatureGroup({
  label,
  items,
  selectedId,
  onSelect,
  onDelete,
}: {
  label: string;
  items: FeatureMeta[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div>
      <div className="px-4 pb-1 pt-3 text-[9px] uppercase tracking-[0.2em] text-white/30">
        {label}
      </div>
      {items.map((p) => {
        const isSelected = p.id === selectedId;
        return (
          <div
            key={p.id}
            className={`group flex w-full items-center transition-colors ${
              isSelected
                ? "bg-[var(--color-ink-inset)]"
                : "hover:bg-[var(--color-ink-inset)]/60"
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className={`flex min-w-0 flex-1 flex-col items-start px-4 py-2.5 text-left ${
                isSelected
                  ? "text-white"
                  : "text-white/55 group-hover:text-white/85"
              }`}
            >
              <div className="w-full truncate text-[12px] font-medium">
                {p.name || p.id}
              </div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-white/40" style={{ fontVariantNumeric: "tabular-nums" }}>
                {p.featureType === "road"
                  ? `width: ${p.roadWidth || 6}px`
                  : formatAreaCompact(p.areaSqMeters)}
                {p.smoothed ? " · curved" : ""}
              </div>
            </button>
            <button
              type="button"
              onClick={() => onDelete(p.id)}
              aria-label="Delete feature"
              className="invisible mr-2 shrink-0 rounded px-1.5 py-0.5 text-[12px] leading-none text-white/30 transition-colors hover:bg-white/10 hover:text-white group-hover:visible"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
