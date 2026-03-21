import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const destRoot = path.join(root, "public", "Cesium");
const assetDirs = ["Assets", "ThirdParty", "Widgets", "Workers"];

if (!existsSync(sourceRoot)) {
  console.warn("[copy-cesium-assets] Cesium build output not found, skipping");
  process.exit(0);
}

mkdirSync(destRoot, { recursive: true });

for (const dir of assetDirs) {
  cpSync(path.join(sourceRoot, dir), path.join(destRoot, dir), {
    force: true,
    recursive: true,
  });
}

console.log("[copy-cesium-assets] Copied Cesium static assets to public/Cesium");
