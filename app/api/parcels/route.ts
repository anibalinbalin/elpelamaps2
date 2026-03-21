import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { ParcelCollection, ParcelFeature } from "@/lib/parcels";
import { mergeParcelCollections } from "@/lib/parcels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PARCELS_FILE_PATH = path.join(process.cwd(), "data", "parcels.json");

function isParcelFeature(value: unknown): value is ParcelFeature {
  if (!value || typeof value !== "object") return false;

  const feature = value as ParcelFeature;
  return (
    feature.type === "Feature" &&
    feature.geometry?.type === "Polygon" &&
    Array.isArray(feature.geometry.coordinates) &&
    Array.isArray(feature.geometry.coordinates[0]) &&
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

export async function GET() {
  return NextResponse.json(await readParcelCollectionFromDisk());
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

  const merged = mode === "replace"
    ? incoming
    : mergeParcelCollections(await readParcelCollectionFromDisk(), incoming);
  const tempPath = `${PARCELS_FILE_PATH}.tmp`;

  await writeFile(tempPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
  await rename(tempPath, PARCELS_FILE_PATH);

  return NextResponse.json({
    ok: true,
    parcelCount: merged.features.length,
    features: merged.features.map((feature) => ({
      id: feature.properties.id,
      name: feature.properties.name,
    })),
  });
}

async function readParcelCollectionFromDisk(): Promise<ParcelCollection> {
  const raw = await readFile(PARCELS_FILE_PATH, "utf8");
  const parsed = parseCollection(JSON.parse(raw));

  if (!parsed) {
    throw new Error("data/parcels.json is not a valid ParcelCollection.");
  }

  return parsed;
}
