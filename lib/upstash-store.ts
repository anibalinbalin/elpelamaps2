import { Redis } from "@upstash/redis";
import { readFile } from "node:fs/promises";
import path from "node:path";

function getClient(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function isStoreConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

/** Read JSON from Redis. Falls back to the bundled seed file when Redis is unset or empty. */
export async function readJson<T>(key: string, seedFile: string): Promise<T> {
  const redis = getClient();
  if (redis) {
    const stored = await redis.get<T>(key);
    if (stored !== null && stored !== undefined) return stored;
  }
  const raw = await readFile(path.join(process.cwd(), seedFile), "utf8");
  return JSON.parse(raw) as T;
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  const redis = getClient();
  if (!redis) throw new Error("Upstash Redis is not configured.");
  await redis.set(key, value);
}

/** Read binary (stored as base64) from Redis. Falls back to the bundled seed file; returns null if neither exists. */
export async function readBinary(key: string, seedFile: string): Promise<Buffer | null> {
  const redis = getClient();
  if (redis) {
    const stored = await redis.get<string>(key);
    if (typeof stored === "string" && stored.length > 0) {
      return Buffer.from(stored, "base64");
    }
  }
  try {
    return await readFile(path.join(process.cwd(), seedFile));
  } catch {
    return null;
  }
}

export async function writeBinary(key: string, value: Buffer): Promise<void> {
  const redis = getClient();
  if (!redis) throw new Error("Upstash Redis is not configured.");
  await redis.set(key, value.toString("base64"));
}
