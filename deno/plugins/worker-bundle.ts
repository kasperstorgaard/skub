import { denoPlugin } from "@deno/esbuild-plugin";
import * as esbuild from "esbuild";
import type { Plugin } from "vite";

/**
 * Vite plugin that bundles game/<name>.ts → static/<name>.js, then copies it to
 * _fresh/server/assets/ after the production build.
 *
 * The copy makes the worker available as a local file alongside the compiled
 * server route, so new URL("./<name>.js", import.meta.url) resolves to a file://
 * URL at runtime on Deno Deploy — bypassing the --cached-only restriction, which
 * only blocks HTTP module fetches, not local file reads.
 */
export function workerBundle(name: string): Plugin {
  return {
    name: `worker-bundle:${name}`,
    async buildStart() {
      const result = await esbuild.build({
        plugins: [denoPlugin()],
        entryPoints: [`./game/${name}.ts`],
        bundle: true,
        format: "esm",
        target: "esnext",
        write: false,
      });

      const content = new TextDecoder().decode(result.outputFiles[0].contents);

      // Write to static/ (served as a static asset)
      await Deno.writeTextFile(`./static/${name}.js`, content);
    },
    async closeBundle() {
      // Prod mode: import.meta.url resolves relative to the compiled route in
      // _fresh/server/assets/, so copy the worker there too.
      try {
        await Deno.copyFile(
          `./static/${name}.js`,
          `./_fresh/server/assets/${name}.js`,
        );
      } catch (e) {
        // _fresh/ doesn't exist in watch/dev mode — skip silently
        if (!(e instanceof Deno.errors.NotFound)) throw e;
      }
    },
  };
}
