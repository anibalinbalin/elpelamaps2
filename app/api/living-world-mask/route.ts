import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MASK_FILE_PATH = path.join(process.cwd(), "data", "living-world-mask.png");

export async function GET() {
  try {
    const buf = await readFile(MASK_FILE_PATH);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Return a 1x1 transparent PNG if file doesn't exist yet
    const EMPTY_PNG = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    return new NextResponse(EMPTY_PNG, {
      headers: { "Content-Type": "image/png" },
    });
  }
}

export async function PUT(request: Request) {
  const body = await request.arrayBuffer();
  if (body.byteLength < 8) {
    return NextResponse.json({ error: "Invalid PNG data" }, { status: 400 });
  }

  const buf = Buffer.from(body);

  // Verify PNG magic bytes
  const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.compare(PNG_MAGIC, 0, 8, 0, 8) !== 0) {
    return NextResponse.json({ error: "Not a valid PNG file" }, { status: 400 });
  }

  const tempPath = `${MASK_FILE_PATH}.tmp`;
  await writeFile(tempPath, buf);
  await rename(tempPath, MASK_FILE_PATH);

  return NextResponse.json({ ok: true, size: buf.byteLength });
}
