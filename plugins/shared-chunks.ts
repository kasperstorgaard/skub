import type { Plugin } from "vite";

const moduleId = "/lib/shared-chunks.ts";

/**
 * Vite plugin that fills lib/shared-chunks.ts in the server build with the
 * chunks Fresh's client entry imports, so pages can modulepreload them.
 * Relies on Fresh building the client environment before the server.
 */
export function sharedChunks(): Plugin {
  let chunks: string[] = [];

  return {
    name: "shared-chunks",
    sharedDuringBuild: true,
    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;

      const entry = Object.values(bundle).find((output) =>
        output.type === "chunk" && output.isEntry &&
        output.name === "client-entry"
      );
      if (entry?.type !== "chunk") return;

      chunks = entry.imports.map((file) => `/${file}`);
    },
    transform(_code, id) {
      if (this.environment.name === "client" || !id.endsWith(moduleId)) {
        return;
      }

      return `export const sharedChunks = ${JSON.stringify(chunks)};`;
    },
  };
}
