import { NextResponse } from "next/server";
import type { NightZoneCollection, NightZoneFeature } from "@/lib/night-zones";
import { isStoreConfigured, readJson, writeJson } from "@/lib/upstash-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REDIS_KEY = "mapsmaps:night-zones";
const SEED_FILE = "data/night-zones.json";

function isZoneFeature(value: unknown): value is NightZoneFeature {
  if (!value || typeof value !== "object") return false;
  const f = value as NightZoneFeature;
  return (
    f.type === "Feature" &&
    f.geometry?.type === "Polygon" &&
    Array.isArray(f.geometry.coordinates) &&
    Array.isArray(f.geometry.coordinates[0]) &&
    typeof f.properties?.id === "string" &&
    typeof f.properties?.name === "string"
  );
}

function parseCollection(value: unknown): NightZoneCollection | null {
  if (!value || typeof value !== "object") return null;
  const c = value as NightZoneCollection;
  if (
    c.type !== "FeatureCollection" ||
    !Array.isArray(c.features) ||
    !c.features.every(isZoneFeature)
  ) {
    return null;
  }
  return c;
}

async function readZones(): Promise<NightZoneCollection> {
  try {
    const raw = await readJson<unknown>(REDIS_KEY, SEED_FILE);
    return parseCollection(raw) ?? { type: "FeatureCollection", features: [] };
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

export async function GET() {
  return NextResponse.json(await readZones());
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const incoming = parseCollection(body);

  if (!incoming) {
    return NextResponse.json(
      { error: "Expected a NightZoneCollection payload." },
      { status: 400 },
    );
  }

  if (!isStoreConfigured()) {
    return NextResponse.json(
      { error: "Persistence is not configured on this deployment." },
      { status: 503 },
    );
  }

  await writeJson(REDIS_KEY, incoming);

  return NextResponse.json({
    ok: true,
    zoneCount: incoming.features.length,
  });
}
