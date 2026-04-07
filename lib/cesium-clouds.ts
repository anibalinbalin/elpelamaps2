// Wrapper to import CloudCollection without triggering Turbopack's
// dynamic require issue with cesium/index.cjs
// @ts-expect-error -- no type declarations for direct source import
export { default as CloudCollection } from "@cesium/engine/Source/Scene/CloudCollection.js";
