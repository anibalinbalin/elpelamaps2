#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputRoot = path.join(repoRoot, "public", "joby");

const homepageUrl = "https://www.jobyaviation.com/";
const sameOriginHosts = new Set(["www.jobyaviation.com", "jobyaviation.com"]);
const allowedExternalHosts = new Set(["cdn.sanity.io"]);
const assetPrefixes = [
  "_next/",
  "images/",
  "videos/",
  "favicon",
  "apple-touch-icon",
  "android-chrome",
  "mstile",
  "site.webmanifest",
];
const assetExtensions = new Set([
  ".js",
  ".css",
  ".map",
  ".json",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".svg",
  ".webp",
  ".avif",
  ".ico",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".txt",
  ".xml",
  ".webmanifest",
]);

const queue = [];
const queued = new Set();
const visited = new Set();
const textAssets = new Map();
const binaryAssets = new Map();
const rawRewrites = new Map();
const normalizedRewrites = new Map();

function shortHash(value) {
  return createHash("sha1").update(value).digest("hex").slice(0, 8);
}

function decodeHtmlValue(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeUrl(value) {
  const url = new URL(value);
  url.hash = "";
  if (url.protocol === "https:" && url.pathname === "") {
    url.pathname = "/";
  }
  return url.toString();
}

function sanitizeSegment(segment) {
  return segment.replace(/[^A-Za-z0-9._~-]/g, "_");
}

function isTextContentType(contentType) {
  return (
    contentType.startsWith("text/") ||
    contentType.includes("javascript") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("svg")
  );
}

function extFromContentType(contentType) {
  if (contentType.includes("javascript")) return ".js";
  if (contentType.includes("css")) return ".css";
  if (contentType.includes("json")) return ".json";
  if (contentType.includes("svg")) return ".svg";
  if (contentType.includes("webmanifest")) return ".webmanifest";
  if (contentType.includes("html")) return ".html";
  return "";
}

function isLikelyAsset(url) {
  const pathname = url.pathname.replace(/^\/+/, "");
  const ext = path.posix.extname(url.pathname).toLowerCase();
  return (
    assetPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    assetExtensions.has(ext)
  );
}

function shouldDownload(normalizedUrl) {
  const url = new URL(normalizedUrl);
  if (!["https:", "http:"].includes(url.protocol)) return false;

  if (sameOriginHosts.has(url.host)) {
    return isLikelyAsset(url);
  }

  if (allowedExternalHosts.has(url.host)) {
    return isLikelyAsset(url);
  }

  return false;
}

function relativeDiskPathForUrl(normalizedUrl, contentType = "") {
  const url = new URL(normalizedUrl);
  const ext = path.posix.extname(url.pathname);
  const hostPrefix = sameOriginHosts.has(url.host) ? "" : `${sanitizeSegment(url.host)}/`;

  let pathname = url.pathname.replace(/^\/+/, "");
  if (!pathname || pathname.endsWith("/")) {
    pathname = `${pathname}index${extFromContentType(contentType) || ".txt"}`;
  } else if (!ext) {
    pathname = `${pathname}${extFromContentType(contentType) || ""}`;
  }

  const segments = pathname.split("/").filter(Boolean).map(sanitizeSegment);
  const currentPath = segments.join("/");
  const currentExt = path.posix.extname(currentPath);
  const suffix = url.search ? `__${shortHash(url.search)}` : "";
  const finalPath = currentExt
    ? currentPath.slice(0, -currentExt.length) + suffix + currentExt
    : currentPath + suffix;

  return `${hostPrefix}${finalPath}`.replace(/\\/g, "/");
}

function localPublicPathForUrl(normalizedUrl, contentType = "") {
  return `/joby/${relativeDiskPathForUrl(normalizedUrl, contentType)}`.replace(
    /\\/g,
    "/",
  );
}

function registerRewrite(rawValue, normalizedUrl, contentType = "") {
  const localPath = localPublicPathForUrl(normalizedUrl, contentType);
  normalizedRewrites.set(normalizedUrl, localPath);

  const url = new URL(normalizedUrl);
  const rawVariants = new Set([
    rawValue,
    rawValue.trim(),
    decodeHtmlValue(rawValue.trim()),
    normalizedUrl,
  ]);

  if (sameOriginHosts.has(url.host)) {
    rawVariants.add(url.pathname + url.search);
  }

  for (const variant of rawVariants) {
    if (variant) {
      rawRewrites.set(variant, localPath);
    }
  }
}

function enqueueAsset(rawValue, baseUrl, contentType = "") {
  if (!rawValue) return;

  const trimmed = rawValue.trim();
  if (
    !trimmed ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("mailto:") ||
    trimmed.startsWith("tel:") ||
    trimmed.startsWith("javascript:")
  ) {
    return;
  }

  let normalizedUrl;
  try {
    normalizedUrl = normalizeUrl(new URL(decodeHtmlValue(trimmed), baseUrl).toString());
  } catch {
    return;
  }

  const resolvedUrl = new URL(normalizedUrl);
  const decodedPath = decodeURIComponent(resolvedUrl.pathname + resolvedUrl.search);
  if (
    resolvedUrl.pathname.endsWith("/") ||
    decodedPath.includes("${") ||
    resolvedUrl.pathname === "/_next/image"
  ) {
    return;
  }

  if (!shouldDownload(normalizedUrl)) {
    return;
  }

  registerRewrite(trimmed, normalizedUrl, contentType);

  if (!queued.has(normalizedUrl)) {
    queued.add(normalizedUrl);
    queue.push(normalizedUrl);
  }
}

function extractHtmlAssetRefs(html, baseUrl) {
  const refs = [];

  for (const match of html.matchAll(/<script[^>]+\ssrc=(["'])([^"']+)\1/gi)) {
    refs.push(match[2]);
  }

  for (const match of html.matchAll(/<(?:img|source)[^>]+\ssrc=(["'])([^"']+)\1/gi)) {
    refs.push(match[2]);
  }

  for (const match of html.matchAll(/<(?:img|source)[^>]+\ssrcset=(["'])([^"']+)\1/gi)) {
    for (const part of match[2].split(",")) {
      const urlPart = part.trim().split(/\s+/)[0];
      if (urlPart) refs.push(urlPart);
    }
  }

  for (const match of html.matchAll(/<video[^>]+\sposter=(["'])([^"']+)\1/gi)) {
    refs.push(match[2]);
  }

  for (const match of html.matchAll(/<link\b([^>]+)>/gi)) {
    const attrs = match[1];
    const rel = attrs.match(/\srel=(["'])([^"']+)\1/i)?.[2]?.toLowerCase() ?? "";
    const href = attrs.match(/\shref=(["'])([^"']+)\1/i)?.[2];
    if (!href) continue;

    const isAssetLink =
      rel.includes("stylesheet") ||
      rel.includes("preload") ||
      rel.includes("icon") ||
      rel.includes("manifest") ||
      /\sas=(["'])([^"']+)\1/i.test(attrs);

    if (isAssetLink) refs.push(href);
  }

  for (const match of html.matchAll(/<meta\b([^>]+)>/gi)) {
    const attrs = match[1];
    const content = attrs.match(/\scontent=(["'])([^"']+)\1/i)?.[2];
    if (!content) continue;
    if (/og:image|twitter:image|og:video|twitter:player/i.test(attrs)) {
      refs.push(content);
    }
  }

  for (const ref of refs) {
    enqueueAsset(ref, baseUrl);
  }

  extractDirectRootAssetRefs(html, baseUrl);
}

function extractCssAssetRefs(text, baseUrl) {
  for (const match of text.matchAll(/url\(([^)]+)\)/gi)) {
    const raw = match[1].trim().replace(/^['"]|['"]$/g, "");
    enqueueAsset(raw, baseUrl);
  }

  for (const match of text.matchAll(/@import\s+(?:url\()?['"]([^"']+)['"]/gi)) {
    enqueueAsset(match[1], baseUrl);
  }
}

function extractGeneralTextRefs(text, baseUrl) {
  for (const match of text.matchAll(/https?:\/\/[^"'`\s)\\]+/gi)) {
    enqueueAsset(match[0], baseUrl);
  }

  for (const match of text.matchAll(/(["'`])((?:\/|\.{1,2}\/)[^"'`\s]+?\.(?:js|css|map|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|otf|eot|mp4|webm|mov|m4v|json|webmanifest))\1/gi)) {
    enqueueAsset(match[2], baseUrl);
  }

  for (const match of text.matchAll(/(["'`])(\/(?:_next|images|videos)\/[^"'`\s]*)\1/gi)) {
    enqueueAsset(match[2], baseUrl);
  }

  extractDirectRootAssetRefs(text, baseUrl);
}

function extractDirectRootAssetRefs(text, baseUrl) {
  for (const match of text.matchAll(/(?:https?:\/\/www\.jobyaviation\.com)?\/_next\/static\/[^"'`\s<>)]+/gi)) {
    enqueueAsset(match[0], baseUrl);
  }
}

function rewriteKnownTokens(text) {
  const entries = [...rawRewrites.entries()].sort((a, b) => b[0].length - a[0].length);
  let rewritten = text;

  for (const [raw, local] of entries) {
    rewritten = rewritten.split(raw).join(local);
  }

  return rewritten;
}

function rewriteRootAssetPrefixes(text) {
  const prefixPattern =
    /([("'`=:\s])\/(_next\/|images\/|videos\/|favicon[^"'`\s)]*|apple-touch-icon[^"'`\s)]*|android-chrome[^"'`\s)]*|mstile[^"'`\s)]*|site\.webmanifest)/g;

  return text.replace(prefixPattern, (_match, prefix, rest) => {
    if (rest.startsWith("joby/")) {
      return `${prefix}/${rest}`;
    }
    return `${prefix}/joby/${rest}`;
  });
}

function rewriteRemainingHostPrefixes(text) {
  return text
    .replace(/https:\/\/cdn\.sanity\.io\//g, "/joby/cdn.sanity.io/")
    .replace(/https:\/\/www\.jobyaviation\.com\/_next\//g, "/joby/_next/")
    .replace(/https:\/\/www\.jobyaviation\.com\/images\//g, "/joby/images/")
    .replace(/https:\/\/www\.jobyaviation\.com\/videos\//g, "/joby/videos/")
    .replace(/\/joby\/joby\//g, "/joby/");
}

function isNeutralizableInternalLink(rawValue) {
  if (!rawValue || rawValue.startsWith("#")) return false;
  if (
    rawValue.startsWith("mailto:") ||
    rawValue.startsWith("tel:") ||
    rawValue.startsWith("javascript:")
  ) {
    return false;
  }

  try {
    const url = new URL(rawValue, homepageUrl);
    if (!sameOriginHosts.has(url.host)) return false;
    if (url.pathname.startsWith("/joby/")) return false;
    return !isLikelyAsset(url);
  } catch {
    return false;
  }
}

function rewriteHtmlLinks(html) {
  return html.replace(
    /(<a\b[^>]*\shref=)(['"])([^"']+)\2/gi,
    (match, prefix, quote, href) => {
      if (!isNeutralizableInternalLink(href)) {
        return match;
      }
      return `${prefix}${quote}#${quote}`;
    },
  );
}

async function ensureDirectoryFor(relativePath) {
  await fs.mkdir(path.join(outputRoot, path.dirname(relativePath)), {
    recursive: true,
  });
}

async function downloadAsset(normalizedUrl) {
  if (visited.has(normalizedUrl)) return;
  visited.add(normalizedUrl);

  const response = await fetch(normalizedUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    if (response.status === 400 || response.status === 404 || response.status === 410) {
      console.warn(`Skipping missing asset: ${normalizedUrl}`);
      return;
    }
    throw new Error(`Failed to fetch ${normalizedUrl}: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  const relativePath = relativeDiskPathForUrl(normalizedUrl, contentType);
  const localPath = localPublicPathForUrl(normalizedUrl, contentType);

  normalizedRewrites.set(normalizedUrl, localPath);
  await ensureDirectoryFor(relativePath);

  const buffer = Buffer.from(await response.arrayBuffer());

  if (isTextContentType(contentType)) {
    const text = buffer.toString("utf8");
    textAssets.set(normalizedUrl, { contentType, relativePath, text });

    if (contentType.includes("css")) {
      extractCssAssetRefs(text, normalizedUrl);
    }
    extractGeneralTextRefs(text, normalizedUrl);
  } else {
    binaryAssets.set(normalizedUrl, { contentType, relativePath });
    await fs.writeFile(path.join(outputRoot, relativePath), buffer);
  }
}

async function drainQueue(concurrency = 8) {
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const nextUrl = queue.shift();
      if (!nextUrl) continue;
      await downloadAsset(nextUrl);
    }
  });

  await Promise.all(workers);
}

async function writeTextAsset(relativePath, text) {
  await ensureDirectoryFor(relativePath);
  await fs.writeFile(path.join(outputRoot, relativePath), text, "utf8");
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true });

  const homepageResponse = await fetch(homepageUrl, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!homepageResponse.ok) {
    throw new Error(
      `Failed to fetch ${homepageUrl}: ${homepageResponse.status} ${homepageResponse.statusText}`,
    );
  }

  const homepageHtml = await homepageResponse.text();
  extractHtmlAssetRefs(homepageHtml, homepageUrl);
  await drainQueue();

  for (const [normalizedUrl, asset] of textAssets.entries()) {
    let rewrittenText = rewriteKnownTokens(asset.text);
    rewrittenText = rewriteRootAssetPrefixes(rewrittenText);
    rewrittenText = rewriteRemainingHostPrefixes(rewrittenText);
    await writeTextAsset(asset.relativePath, rewrittenText);
    textAssets.set(normalizedUrl, { ...asset, text: rewrittenText });
  }

  let rewrittenHomepage = rewriteKnownTokens(homepageHtml);
  rewrittenHomepage = rewriteRootAssetPrefixes(rewrittenHomepage);
  rewrittenHomepage = rewriteRemainingHostPrefixes(rewrittenHomepage);
  rewrittenHomepage = rewriteHtmlLinks(rewrittenHomepage);
  await writeTextAsset("index.html", rewrittenHomepage);

  const manifest = {
    source: homepageUrl,
    generatedAt: new Date().toISOString(),
    totalBinaryAssets: binaryAssets.size,
    totalTextAssets: textAssets.size + 1,
  };

  await writeTextAsset("mirror-manifest.json", JSON.stringify(manifest, null, 2));

  console.log(
    `Mirrored Joby homepage to ${outputRoot} with ${binaryAssets.size} binary assets and ${textAssets.size + 1} text files.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
