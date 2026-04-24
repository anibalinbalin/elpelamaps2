import { NextResponse } from "next/server";
import type { ParcelCollection, ParcelFeature } from "@/lib/parcels";
import { mergeParcelCollections } from "@/lib/parcels";
import { isStoreConfigured, readJson, writeJson } from "@/lib/upstash-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REDIS_KEY = "mapsmaps:parcels";
const SEED_FILE = "data/parcels.json";

function isParcelFeature(value: unknown): value is ParcelFeature {
  if (!value || typeof value !== "object") return false;

  const feature = value as ParcelFeature;
  const geomType = feature.geometry?.type;
  const hasCoords = Array.isArray(feature.geometry?.coordinates);
  const validGeom =
    (geomType === "Polygon" && hasCoords && Array.isArray(feature.geometry.coordinates[0])) ||
    (geomType === "LineString" && hasCoords) ||
    (geomType === "Point" && hasCoords);

  return (
    feature.type === "Feature" &&
    !!validGeom &&
    typeof feature.properties?.id === "string" &&
    typeof feature.properties?.name === "string" &&
    typeof feature.properties?.areaSqMeters === "number"
  );
}

function parseCollection(value: unknown): ParcelCollection | null {
  if (!value || typeof value !== "object") return null;

  const collection = value as ParcelCollection;
  if (
    collection.type !== "FeatureCollection" ||
    !Array.isArray(collection.features) ||
    !collection.features.every(isParcelFeature)
  ) {
    return null;
  }

  return collection;
}

async function readParcelCollection(): Promise<ParcelCollection> {
  const raw = await readJson<unknown>(REDIS_KEY, SEED_FILE);
  const parsed = parseCollection(raw);
  if (!parsed) {
    throw new Error("Stored parcels data is not a valid ParcelCollection.");
  }
  return parsed;
}

export async function GET() {
  return NextResponse.json(await readParcelCollection());
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const incoming = parseCollection(body);
  const mode = new URL(request.url).searchParams.get("mode");

  if (!incoming) {
    return NextResponse.json(
      { error: "Expected a ParcelCollection payload." },
      { status: 400 },
    );
  }

  if (!isStoreConfigured()) {
    return NextResponse.json(
      { error: "Persistence is not configured on this deployment." },
      { status: 503 },
    );
  }

  const merged = mode === "replace"
    ? incoming
    : mergeParcelCollections(await readParcelCollection(), incoming);

  await writeJson(REDIS_KEY, merged);

  return NextResponse.json({
    ok: true,
    parcelCount: merged.features.length,
    features: merged.features.map((feature) => ({
      id: feature.properties.id,
      name: feature.properties.name,
    })),
  });
}
