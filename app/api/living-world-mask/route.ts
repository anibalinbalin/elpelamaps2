import { NextResponse } from "next/server";
import { isStoreConfigured, readBinary, writeBinary } from "@/lib/upstash-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REDIS_KEY = "mapsmaps:living-world-mask";
const SEED_FILE = "data/living-world-mask.png";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const EMPTY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

export async function GET() {
  const buf = (await readBinary(REDIS_KEY, SEED_FILE)) ?? EMPTY_PNG;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store",
    },
  });
}

export async function PUT(request: Request) {
  const body = await request.arrayBuffer();
  if (body.byteLength < 8) {
    return NextResponse.json({ error: "Invalid PNG data" }, { status: 400 });
  }

  const buf = Buffer.from(body);
  if (buf.compare(PNG_MAGIC, 0, 8, 0, 8) !== 0) {
    return NextResponse.json({ error: "Not a valid PNG file" }, { status: 400 });
  }

  if (!isStoreConfigured()) {
    return NextResponse.json(
      { error: "Persistence is not configured on this deployment." },
      { status: 503 },
    );
  }

  await writeBinary(REDIS_KEY, buf);

  return NextResponse.json({ ok: true, size: buf.byteLength });
}
