// deno-lint-ignore-file skub-imports/use-hash-alias
import { fresh } from "@fresh/plugin-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import { puzzleManifest } from "./plugins/puzzle-manifest.ts";
import { workerBundle } from "./plugins/worker-bundle.ts";

export default defineConfig({
  server: {
    watch: {
      // The generator writes candidate files here at runtime (POST
      // /api/generated). Without this, Vite's dev watcher treats each new file
      // as a source change and full-reloads the page — wiping the just-shown
      // candidate back to the empty server state.
      ignored: ["**/generated/**"],
    },
  },
  plugins: [
    workerBundle("solver-worker"),
    workerBundle("generate-worker"),
    puzzleManifest(),
    tailwindcss(),
    fresh(),
  ],
});
