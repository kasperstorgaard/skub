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
      // /api/candidates). Without this, Vite's dev watcher treats each new file
      // as a source change and full-reloads the page — wiping the just-shown
      // candidate back to the empty server state.
      ignored: ["**/candidates/**"],
    },
    // Transform the entries in the background as soon as the server boots,
    // rather than on the first request. Same total work, but it overlaps with
    // the time it takes to actually open the browser.
    warmup: {
      clientFiles: ["./client.ts", "./islands/*.tsx"],
      ssrFiles: ["./routes/**/*.tsx"],
    },
  },
  plugins: [
    workerBundle("generate-worker"),
    workerBundle("solver-worker"),
    puzzleManifest(),
    tailwindcss(),
    fresh(),
  ],
});
