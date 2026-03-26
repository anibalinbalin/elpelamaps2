"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type Feature from "ol/Feature";
import GeoJSON from "ol/format/GeoJSON";
import type Geometry from "ol/geom/Geometry";
import MultiPoint from "ol/geom/MultiPoint";
import Polygon from "ol/geom/Polygon";
import { Draw, Modify, Select, Snap } from "ol/interaction";
import { defaults as defaultInteractions } from "ol/interaction/defaults";
import Map from "ol/Map";
import View from "ol/View";
import { click } from "ol/events/condition";
import { createEmpty, isEmpty as isEmptyExtent } from "ol/extent";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import VectorSource from "ol/source/Vector";
import XYZ from "ol/source/XYZ";
import { Circle as CircleStyle, Fill, Stroke, Style } from "ol/style";
import { JOSE_IGNACIO_CENTER } from "@/lib/constants";
import { EditorAccessDialog } from "./editor-access-dialog";
import { grantEditorAccess, hasEditorAccess } from "@/lib/editor-access";
import { sphericalArea } from "@/lib/geo-area";
import { formatArea, formatAreaCompact } from "@/lib/geo-utils";
import type { ParcelCollection, ParcelFeature, ParcelProperties } from "@/lib/parcels";

const baseParcelStyle = new Style({
  fill: new Fill({ color: "rgba(232, 221, 193, 0.22)" }),
  stroke: new Stroke({ color: "rgba(255,255,255,0.95)", width: 2.2 }),
});

const selectedParcelPolygonStyle = new Style({
  fill: new Fill({ color: "rgba(56, 231, 190, 0.2)" }),
  stroke: new Stroke({ color: "#38e7be", width: 3 }),
});

const selectedParcelVertexStyle = new Style({
  geometry: (feature) => {
    const geometry = feature.getGeometry();
    if (!(geometry instanceof Polygon)) {
      return undefined;
    }

    const ring = geometry.getCoordinates()[0] ?? [];
    if (ring.length <= 1) {
      return undefined;
    }

    return new MultiPoint(ring.slice(0, -1));
  },
  image: new CircleStyle({
    radius: 7,
    fill: new Fill({ color: "#ffffff" }),
    stroke: new Stroke({ color: "#38e7be", width: 3 }),
  }),
});

const selectedParcelStyle = [selectedParcelPolygonStyle, selectedParcelVertexStyle];

type EditorMode = "select" | "draw";

export function ParcelEditor() {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const viewRef = useRef<View | null>(null);
  const sourceRef = useRef<VectorSource<Feature<Geometry>> | null>(null);
  const selectRef = useRef<Select | null>(null);
  const modifyRef = useRef<Modify | null>(null);
  const drawRef = useRef<Draw | null>(null);
  const snapRef = useRef<Snap | null>(null);
  const geoJsonRef = useRef(new GeoJSON());
  const selectedIdRef = useRef<string | null>(null);
  const previousSelectedIdRef = useRef<string | null>(null);
  const pendingNameFocusIdRef = useRef<string | null>(null);
  const skipNextSelectionAutosaveRef = useRef(false);
  const parcelCollectionRef = useRef<ParcelCollection | null>(null);
  const dirtyRef = useRef(false);
  const saveStateRef = useRef<"idle" | "saving" | "saved" | "error">("idle");
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const [parcelCollection, setParcelCollection] = useState<ParcelCollection | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [accessReady, setAccessReady] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const selectedParcel = useMemo(
    () =>
      selectedId
        ? parcelCollection?.features.find((feature) => feature.properties.id === selectedId) ?? null
        : null,
    [parcelCollection, selectedId],
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    parcelCollectionRef.current = parcelCollection;
  }, [parcelCollection]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    saveStateRef.current = saveState;
  }, [saveState]);

  useEffect(() => {
    const granted = hasEditorAccess();
    setHasAccess(granted);
    setAccessReady(true);
  }, []);

  useEffect(() => {
    if (!selectedParcel) {
      return;
    }

    if (pendingNameFocusIdRef.current !== selectedParcel.properties.id) {
      return;
    }

    pendingNameFocusIdRef.current = null;
    requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
  }, [selectedParcel]);

  const syncParcelCollectionFromSource = useCallback(
    (markDirty: boolean, extraFeatures?: Feature<Geometry>[]) => {
      const source = sourceRef.current;
      if (!source) return;

      const allFeatures = extraFeatures
        ? [...source.getFeatures(), ...extraFeatures]
        : source.getFeatures();
      const collection = serializeFeatures(allFeatures, geoJsonRef.current);
      setParcelCollection(collection);

      const activeSelectedId = selectedIdRef.current;
      if (
        activeSelectedId &&
        !collection.features.some((feature) => feature.properties.id === activeSelectedId)
      ) {
        selectedIdRef.current = null;
        setSelectedId(null);
      }

      if (markDirty) {
        setDirty(true);
        setSaveState("idle");
        setSaveMessage("");
      }
    },
    [],
  );

  const fitToFeatures = useCallback((selectedOnly = false, targetId?: string | null) => {
    const source = sourceRef.current;
    const view = viewRef.current;
    const map = mapRef.current;
    if (!source || !view || !map) return;

    const activeId = targetId ?? selectedIdRef.current;
    const extent = createEmpty();
    const features = selectedOnly && activeId
      ? source.getFeatures().filter((feature) => getFeatureId(feature) === activeId)
      : source.getFeatures();

    for (const feature of features) {
      const geometry = feature.getGeometry();
      if (!geometry) continue;
      extent[0] = Math.min(extent[0], geometry.getExtent()[0]);
      extent[1] = Math.min(extent[1], geometry.getExtent()[1]);
      extent[2] = Math.max(extent[2], geometry.getExtent()[2]);
      extent[3] = Math.max(extent[3], geometry.getExtent()[3]);
    }

    if (isEmptyExtent(extent)) return;

    view.fit(extent, {
      padding: [72, 72, 72, 408],
      duration: 360,
      maxZoom: 19.5,
    });
  }, []);

  const saveParcels = useCallback(async (successMessage = "Saved parcel changes automatically.") => {
    const collection = parcelCollectionRef.current;
    if (!collection || saveStateRef.current === "saving") {
      return;
    }

    setSaveState("saving");
    setSaveMessage("");

    try {
      const response = await fetch("/api/parcels?mode=replace", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(collection),
      });

      if (!response.ok) {
        throw new Error("Could not save parcel edits to project data.");
      }

      setDirty(false);
      setSaveState("saved");
      setSaveMessage(successMessage);
    } catch (saveError) {
      setSaveState("error");
      setSaveMessage(
        saveError instanceof Error
          ? saveError.message
          : "Could not save parcel edits to project data.",
      );
    }
  }, []);

  const applyEditorMode = useCallback((mode: EditorMode) => {
    setEditorMode(mode);

    const draw = drawRef.current;
    const select = selectRef.current;
    if (draw) {
      draw.setActive(mode === "draw");
    }
    if (select) {
      select.setActive(mode === "select");
      if (mode === "draw") {
        select.getFeatures().clear();
        setSelectedId(null);
      }
    }
  }, []);

  const loadParcels = useCallback(async (keepSelection = false) => {
    const source = sourceRef.current;
    if (!source) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/parcels", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not load parcel data.");
      }

      const collection = parseParcelCollection(await response.json());
      source.clear(true);

      const features = geoJsonRef.current.readFeatures(collection, {
        dataProjection: "EPSG:4326",
        featureProjection: "EPSG:3857",
      }) as Feature<Geometry>[];

      for (const feature of features) {
        const id = String(feature.get("id") ?? feature.getId() ?? "");
        feature.setId(id);
        feature.set("id", id);
      }

      source.addFeatures(features);
      setParcelCollection(serializeFeatures(source.getFeatures(), geoJsonRef.current));
      setDirty(false);
      setSaveState("idle");
      setSaveMessage("");

      const nextSelectionId =
        keepSelection &&
        selectedIdRef.current &&
        features.some((feature) => getFeatureId(feature) === selectedIdRef.current)
          ? selectedIdRef.current
          : features[0]
            ? getFeatureId(features[0])
            : null;

      const selectedFeature = nextSelectionId
        ? features.find((feature) => getFeatureId(feature) === nextSelectionId) ?? null
        : null;

      const selectedCollection = selectRef.current?.getFeatures();
      selectedCollection?.clear();
      if (selectedFeature) {
        selectedCollection?.push(selectedFeature);
      }
      skipNextSelectionAutosaveRef.current = true;
      selectedIdRef.current = nextSelectionId;
      setSelectedId(nextSelectionId);

      requestAnimationFrame(() => {
        fitToFeatures(Boolean(selectedFeature), nextSelectionId);
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load parcel data.",
      );
    } finally {
      setLoading(false);
    }
  }, [fitToFeatures]);

  useEffect(() => {
    if (!hasAccess || !mapElementRef.current || mapRef.current) return;

    const source = new VectorSource<Feature<Geometry>>();
    const vectorLayer = new VectorLayer({
      source,
      style: baseParcelStyle,
    });

    const baseLayer = new TileLayer({
      source: createBasemapSource(mapboxToken),
    });

    const select = new Select({
      condition: click,
      hitTolerance: 8,
      layers: [vectorLayer],
      style: selectedParcelStyle,
    });

    const modify = new Modify({
      features: select.getFeatures(),
    });

    const draw = new Draw({
      source,
      type: "Polygon",
    });
    draw.setActive(false);

    const snap = new Snap({
      source,
    });

    const view = new View({
      center: fromLonLat([JOSE_IGNACIO_CENTER.lon, JOSE_IGNACIO_CENTER.lat]),
      zoom: 17.2,
      minZoom: 13,
      maxZoom: 22,
    });

    const map = new Map({
      target: mapElementRef.current,
      layers: [baseLayer, vectorLayer],
      view,
      interactions: defaultInteractions({
        doubleClickZoom: false,
      }),
    });

    map.addInteraction(select);
    map.addInteraction(modify);
    map.addInteraction(draw);
    map.addInteraction(snap);

    select.on("select", () => {
      const feature = select.getFeatures().item(0) ?? null;
      const nextSelectedId = feature ? getFeatureId(feature) : null;
      selectedIdRef.current = nextSelectedId;
      setSelectedId(nextSelectedId);
    });

    modify.on("modifyend", () => {
      syncParcelCollectionFromSource(true);
    });

    draw.on("drawend", (event) => {
      const existingIds = new Set(
        source.getFeatures()
          .map((feature) => getFeatureId(feature))
          .filter(Boolean),
      );

      seedNewParcelFeature(event.feature, existingIds);
      applyEditorMode("select");
      select.getFeatures().clear();
      select.getFeatures().push(event.feature);
      const nextSelectedId = getFeatureId(event.feature);
      pendingNameFocusIdRef.current = nextSelectedId;
      skipNextSelectionAutosaveRef.current = true;
      selectedIdRef.current = nextSelectedId;
      setSelectedId(nextSelectedId);
      syncParcelCollectionFromSource(true, [event.feature]);

      requestAnimationFrame(() => {
        fitToFeatures(true, nextSelectedId);
      });
    });

    mapRef.current = map;
    viewRef.current = view;
    sourceRef.current = source;
    selectRef.current = select;
    modifyRef.current = modify;
    drawRef.current = draw;
    snapRef.current = snap;

    loadParcels();

    return () => {
      map.setTarget(undefined);
      mapRef.current = null;
      viewRef.current = null;
      sourceRef.current = null;
      selectRef.current = null;
      modifyRef.current = null;
      drawRef.current = null;
      snapRef.current = null;
    };
  }, [applyEditorMode, fitToFeatures, hasAccess, loadParcels, mapboxToken, syncParcelCollectionFromSource]);

  useEffect(() => {
    if (!accessReady || !hasAccess) {
      previousSelectedIdRef.current = selectedId;
      return;
    }

    const previousSelectedId = previousSelectedIdRef.current;
    if (skipNextSelectionAutosaveRef.current) {
      skipNextSelectionAutosaveRef.current = false;
      previousSelectedIdRef.current = selectedId;
      return;
    }

    if (previousSelectedId && previousSelectedId !== selectedId && dirtyRef.current) {
      void saveParcels();
    }

    previousSelectedIdRef.current = selectedId;
  }, [accessReady, hasAccess, saveParcels, selectedId]);

  function handleAccessGranted() {
    grantEditorAccess();
    setHasAccess(true);
  }

  function handleAccessCancelled() {
    window.location.assign("/viewer");
  }

  function selectParcelById(id: string) {
    const source = sourceRef.current;
    const select = selectRef.current;
    if (!source || !select) return;

    const feature = source.getFeatures().find((candidate) => getFeatureId(candidate) === id);
    if (!feature) return;

    applyEditorMode("select");
    select.getFeatures().clear();
    select.getFeatures().push(feature);
    selectedIdRef.current = id;
    setSelectedId(id);
    fitToFeatures(true, id);
  }

  function updateSelectedParcelProperty<K extends keyof ParcelProperties>(
    key: K,
    value: ParcelProperties[K],
  ) {
    const source = sourceRef.current;
    if (!source || !selectedId) return;

    const feature = source.getFeatures().find((candidate) => getFeatureId(candidate) === selectedId);
    if (!feature) return;

    feature.set(key as string, value);
    if (key === "id" && typeof value === "string") {
      feature.setId(value);
    }
    syncParcelCollectionFromSource(true);
  }

  function deleteParcelById(id: string) {
    const source = sourceRef.current;
    const select = selectRef.current;
    if (!source) return;

    const feature = source.getFeatures().find((candidate) => getFeatureId(candidate) === id);
    if (!feature) return;

    const deletingSelectedParcel = selectedIdRef.current === id;
    source.removeFeature(feature);
    if (deletingSelectedParcel) {
      select?.getFeatures().clear();
      selectedIdRef.current = null;
      setSelectedId(null);
    }
    syncParcelCollectionFromSource(true);
    if (!deletingSelectedParcel) {
      void saveParcels("Deleted parcel and saved changes automatically.");
    }
    requestAnimationFrame(() => fitToFeatures(false));
  }

  const parcelList = parcelCollection?.features ?? [];
  const headerStatus = saveState === "saving"
    ? "Saving changes"
    : saveState === "error"
      ? "Save failed"
      : dirty
        ? "Changes pending"
        : "All changes saved";

  if (!accessReady) {
    return <div className="h-screen w-screen bg-[#111417]" />;
  }

  if (!hasAccess) {
    return (
      <div className="relative h-screen w-screen overflow-hidden bg-[#111417]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,231,190,0.1),rgba(17,20,23,0)_44%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />
        <EditorAccessDialog
          onSuccess={handleAccessGranted}
          onCancel={handleAccessCancelled}
        />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#111417] text-white">
      <div ref={mapElementRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-[#0b1015]/74 via-[#0b1015]/28 to-transparent px-5 py-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-[26px] border border-white/10 bg-[rgba(19,24,30,0.88)] px-4 py-3 shadow-[0_18px_48px_rgba(3,10,16,0.34)] backdrop-blur-xl">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/44">
              Precise Editor
            </div>
            <div className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-white">
              Parcel Geometry Workspace
            </div>
          </div>
          <div className="mx-1 h-9 w-px bg-white/10" />
          <Link
            href="/viewer"
            className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/78 transition-colors duration-200 hover:border-white/18 hover:bg-white/[0.08] hover:text-white"
          >
            3D Viewer
          </Link>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-[999px] border border-white/10 bg-[rgba(19,24,30,0.84)] px-3 py-2 text-[11px] text-white/72 shadow-[0_18px_48px_rgba(3,10,16,0.28)] backdrop-blur-xl">
          <span>{parcelList.length} parcels</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>{headerStatus}</span>
        </div>
      </div>

      <aside className="pointer-events-auto absolute inset-y-4 left-4 z-20 flex w-[380px] flex-col rounded-[30px] border border-white/10 bg-[rgba(16,20,25,0.92)] p-4 shadow-[0_32px_90px_rgba(3,10,16,0.42)] backdrop-blur-xl">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyEditorMode("draw")}
            className={`rounded-[18px] px-4 py-2 text-[13px] font-semibold transition-colors duration-200 ${
              editorMode === "draw"
                ? "bg-[#2a8f74] text-white"
                : "border border-white/10 bg-white/[0.04] text-white/78 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            New Parcel
          </button>
          <button
            type="button"
            onClick={() => applyEditorMode("select")}
            className={`rounded-[18px] px-4 py-2 text-[13px] font-semibold transition-colors duration-200 ${
              editorMode === "select"
                ? "bg-white/[0.14] text-white"
                : "border border-white/10 bg-white/[0.04] text-white/78 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            Select
          </button>
          <button
            type="button"
            onClick={() => fitToFeatures(Boolean(selectedId))}
            className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/78 transition-colors duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
          >
            {selectedId ? "Fit Selected" : "Fit Parcels"}
          </button>
          <button
            type="button"
            onClick={() => loadParcels(false)}
            className="rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/78 transition-colors duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
          >
            Reset
          </button>
        </div>

        <div className="mt-3 rounded-[22px] border border-white/8 bg-white/[0.04] px-4 py-3 text-[12px] leading-5 text-white/68">
          Click a parcel to edit it, drag vertices for geometry changes, and use New Parcel for new boundaries. Changes save automatically when you leave a parcel. Snapping is active against all parcel edges.
        </div>

        {saveMessage && (
          <div
            className={`mt-3 rounded-[18px] px-4 py-3 text-[12px] ${
              saveState === "error"
                ? "border border-red-400/30 bg-red-400/[0.08] text-red-200"
                : "border border-white/8 bg-white/[0.04] text-white/70"
            }`}
          >
            {saveMessage}
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-[18px] border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-[12px] text-red-200">
            {error}
          </div>
        )}

        <div className="mt-4 flex min-h-0 flex-1 gap-4">
          <div className="flex min-h-0 w-[156px] flex-col">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
              Parcels
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                {loading && parcelList.length === 0 && (
                  <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-white/52">
                    Loading parcel data...
                  </div>
                )}

                {!loading && parcelList.length === 0 && (
                  <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-4 text-[12px] text-white/52">
                    No parcels loaded.
                  </div>
                )}

                {parcelList.map((feature) => {
                  const active = feature.properties.id === selectedId;

                  return (
                    <div key={feature.properties.id} className="flex items-stretch gap-2">
                      <button
                        type="button"
                        onClick={() => selectParcelById(feature.properties.id)}
                        className={`block min-w-0 flex-1 rounded-[18px] border px-4 py-3 text-left transition-colors duration-200 ${
                          active
                            ? "border-[#38e7be]/38 bg-[#38e7be]/12 text-white"
                            : "border-white/8 bg-white/[0.03] text-white/70 hover:border-white/14 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <div className="truncate text-[12px] font-semibold tracking-[-0.01em]">
                          {feature.properties.name}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
                          {feature.properties.id}
                        </div>
                        <div className="mt-2 text-[11px] text-white/56">
                          {formatAreaCompact(feature.properties.areaSqMeters)}
                        </div>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${feature.properties.name}`}
                        title={`Delete ${feature.properties.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteParcelById(feature.properties.id);
                        }}
                        className={`flex w-11 shrink-0 items-center justify-center rounded-[16px] border transition-colors duration-200 ${
                          active
                            ? "border-[#38e7be]/26 bg-[#38e7be]/10 text-[#c7fff1] hover:bg-[#38e7be]/16"
                            : "border-white/8 bg-white/[0.03] text-white/48 hover:border-white/14 hover:bg-white/[0.06] hover:text-white/78"
                        }`}
                      >
                        <TrashCanIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">
              Selection
            </div>

            {!selectedParcel ? (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-5 py-6 text-[13px] leading-6 text-white/54">
                Select a parcel to adjust its geometry and metadata. New parcels land here immediately after drawing.
              </div>
            ) : (
              <div className="space-y-3 rounded-[24px] border border-white/8 bg-white/[0.035] p-4">
                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    Area
                  </div>
                  <div className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-white">
                    {formatArea(selectedParcel.properties.areaSqMeters)}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    Name
                  </span>
                  <input
                    ref={nameInputRef}
                    value={selectedParcel.properties.name}
                    onChange={(event) => updateSelectedParcelProperty("name", event.target.value)}
                    placeholder="Parcel name"
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] text-white outline-none transition-colors duration-200 focus:border-white/18 focus:bg-white/[0.08]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    Status
                  </span>
                  <select
                    value={selectedParcel.properties.status ?? "for-sale"}
                    onChange={(event) =>
                      updateSelectedParcelProperty(
                        "status",
                        event.target.value as ParcelProperties["status"],
                      )
                    }
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] text-white outline-none transition-colors duration-200 focus:border-white/18 focus:bg-white/[0.08]"
                  >
                    <option value="for-sale">For Sale</option>
                    <option value="reserved">Reserved</option>
                    <option value="sold">Sold</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    Price USD
                  </span>
                  <input
                    type="number"
                    value={selectedParcel.properties.priceUSD ?? ""}
                    onChange={(event) =>
                      updateSelectedParcelProperty(
                        "priceUSD",
                        event.target.value === "" ? undefined : Number(event.target.value),
                      )
                    }
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] text-white outline-none transition-colors duration-200 focus:border-white/18 focus:bg-white/[0.08]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    Zoning
                  </span>
                  <input
                    value={selectedParcel.properties.zoning ?? ""}
                    onChange={(event) => updateSelectedParcelProperty("zoning", event.target.value || undefined)}
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] text-white outline-none transition-colors duration-200 focus:border-white/18 focus:bg-white/[0.08]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    Contact URL
                  </span>
                  <input
                    value={selectedParcel.properties.contactUrl ?? ""}
                    onChange={(event) =>
                      updateSelectedParcelProperty("contactUrl", event.target.value || undefined)
                    }
                    className="w-full rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] text-white outline-none transition-colors duration-200 focus:border-white/18 focus:bg-white/[0.08]"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-white/38">
                    Description
                  </span>
                  <textarea
                    value={selectedParcel.properties.description ?? ""}
                    onChange={(event) =>
                      updateSelectedParcelProperty("description", event.target.value || undefined)
                    }
                    rows={5}
                    className="w-full resize-none rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-[14px] text-white outline-none transition-colors duration-200 focus:border-white/18 focus:bg-white/[0.08]"
                  />
                </label>

                <div className="rounded-[18px] border border-white/8 bg-white/[0.03] px-4 py-3 text-[11px] leading-5 text-white/54">
                  Parcel ID remains stable after creation so external references do not break. Geometry edits automatically recalculate area before save.
                </div>
              </div>
            )}
          </div>
        </div>

        <a
          href="/viewer"
          className="mt-3 flex items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] font-semibold text-white/68 transition-colors duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          Back to Viewer
        </a>
      </aside>
    </div>
  );
}

function createBasemapSource(mapboxToken?: string) {
  if (mapboxToken) {
    return new XYZ({
      url: `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/512/{z}/{x}/{y}?access_token=${mapboxToken}`,
      tileSize: 512,
      crossOrigin: "anonymous",
      attributions:
        '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> ' +
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    });
  }

  return new XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attributions:
      "Tiles &copy; Esri",
    crossOrigin: "anonymous",
  });
}

function parseParcelCollection(value: unknown): ParcelCollection {
  if (!value || typeof value !== "object") {
    throw new Error("Parcel API returned an invalid payload.");
  }

  const collection = value as ParcelCollection;
  if (collection.type !== "FeatureCollection" || !Array.isArray(collection.features)) {
    throw new Error("Parcel API returned an invalid feature collection.");
  }

  return {
    type: "FeatureCollection",
    features: collection.features.map(normalizeParcelFeature),
  };
}

function serializeFeatures(
  features: Feature<Geometry>[],
  geoJson: GeoJSON,
): ParcelCollection {
  const collection = geoJson.writeFeaturesObject(features, {
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
    decimals: 14,
  }) as ParcelCollection;

  return {
    type: "FeatureCollection",
    features: collection.features.map(normalizeParcelFeature),
  };
}

function normalizeParcelFeature(feature: ParcelFeature): ParcelFeature {
  const ring = closeRing(feature.geometry.coordinates[0] as [number, number][]);
  const areaSqMeters = Math.round(sphericalArea(ring));
  const properties = feature.properties ?? ({} as ParcelProperties);
  const id = String(properties.id ?? `parcel-${Date.now().toString(36)}`);

  return {
    type: "Feature",
    properties: {
      ...properties,
      id,
      name: properties.name ?? id,
      areaSqMeters,
      status: properties.status ?? "for-sale",
    },
    geometry: {
      type: "Polygon",
      coordinates: [ring],
    },
  };
}

function seedNewParcelFeature(
  feature: Feature<Geometry>,
  existingIds: Set<string>,
) {
  const id = uniqueParcelId(existingIds);
  feature.setId(id);
  feature.setProperties(
    {
      id,
      name: "New Parcel",
      status: "for-sale",
      areaSqMeters: 0,
    } satisfies Partial<ParcelProperties>,
    false,
  );
}

function uniqueParcelId(existingIds: Set<string>): string {
  let index = existingIds.size + 1;
  let next = `parcel-${index}`;
  while (existingIds.has(next)) {
    index += 1;
    next = `parcel-${index}`;
  }
  return next;
}

function closeRing(ring: [number, number][]): [number, number][] {
  if (ring.length === 0) return ring;

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }

  return [...ring, first];
}

function getFeatureId(feature: Feature<Geometry>): string {
  return String(feature.get("id") ?? feature.getId() ?? "");
}

function TrashCanIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16" />
      <path d="M9 3h6" />
      <path d="M7 7l1 12h8l1-12" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}
