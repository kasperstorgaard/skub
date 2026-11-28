// deno-lint-ignore-file skub-imports/use-hash-alias
/**
 * Plugin declaration to build manifest when building / developing
 * _note: must use relative imports, as that is a Deno requirement_
 */
import { Plugin } from "vite";

import { updateManifest } from "../lib/manifest.ts";

/**
 * Vite build plugin that generates a file manifest at static/puzzles/manifest.json.
 * Provides a full list of puzzles with relevant metadata, so we can retrieve them at runtime.
 */
export function puzzleManifest(): Plugin {
  return {
    name: "puzzle-manifest",
    buildStart: updateManifest,
  };
}
