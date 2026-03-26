import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { NightZoneCollection, NightZoneFeature } from "@/lib/night-zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZONES_FILE_PATH = path.join(process.cwd(), "data", "night-zones.json");

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

async function readZonesFromDisk(): Promise<NightZoneCollection> {
  try {
    const raw = await readFile(ZONES_FILE_PATH, "utf8");
    const parsed = parseCollection(JSON.parse(raw));
    if (!parsed) throw new Error("Invalid night-zones.json");
    return parsed;
  } catch {
    return { type: "FeatureCollection", features: [] };
  }
}

export async function GET() {
  return NextResponse.json(await readZonesFromDisk());
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

  const tempPath = `${ZONES_FILE_PATH}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(incoming, null, 2)}\n`, "utf8");
  await rename(tempPath, ZONES_FILE_PATH);

  return NextResponse.json({
    ok: true,
    zoneCount: incoming.features.length,
  });
}
