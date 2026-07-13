// deno-lint-ignore-file skub-imports/use-hash-alias
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import { puzzleManifest } from "./plugins/puzzle-manifest.ts";
import { workerBundle } from "./plugins/worker-bundle.ts";

export default defineConfig({
  plugins: [
    workerBundle("solver-worker"),
    workerBundle("generate-worker"),
    puzzleManifest(),
    tailwindcss(),
    fresh(),
  ],
});
