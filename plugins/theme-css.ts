import type { Plugin } from "vite";

const THEMES_DIR = "styles/themes";
const moduleId = "/lib/theme-assets.ts";
const urlsId = "virtual:theme-urls";
const resolvedUrlsId = `\0${urlsId}`;

type ThemeAssets = { css: string; fonts: string[] };

/**
 * Vite plugin that builds each styles/themes/<key>.css as its own hashed
 * asset and fills lib/theme-assets.ts in the server build with the asset's
 * path and the fonts it references, so a page links only the active theme and
 * preloads only its fonts. In dev the map points at the source files, which
 * Vite serves transformed.
 *
 * Works the same way as plugins/shared-chunks.ts: the client build records,
 * the server build reads. Relies on Fresh building the client environment
 * before the server.
 */
export function themeCss(): Plugin {
  let isBuild = false;
  let root = "";
  const built: Record<string, ThemeAssets> = {};

  const themeKeys = async () => {
    const keys: string[] = [];
    for await (const entry of Deno.readDir(THEMES_DIR)) {
      if (entry.isFile && entry.name.endsWith(".css")) {
        keys.push(entry.name.slice(0, -".css".length));
      }
    }
    return keys.sort();
  };

  const fontUrlRe = /url\(["']?([^"')]+\.woff2)["']?\)/g;
  const fontUrls = (css: string) =>
    [...css.matchAll(fontUrlRe)].map((m) => m[1]);

  return {
    name: "theme-css",
    sharedDuringBuild: true,
    configResolved(config) {
      isBuild = config.command === "build";
      root = config.root;
    },
    // A chunk that imports every theme with ?url is what makes the client
    // build emit them as assets; the chunk itself is never loaded.
    buildStart() {
      if (this.environment.name !== "client" || !isBuild) return;
      this.emitFile({ type: "chunk", id: urlsId, name: "theme-urls" });
    },
    resolveId(id) {
      if (id === urlsId) return resolvedUrlsId;
    },
    async load(id) {
      if (id !== resolvedUrlsId) return;
      const keys = await themeKeys();
      const imports = keys.map((key, i) =>
        `import theme${i} from "${root}/${THEMES_DIR}/${key}.css?url";`
      );
      const names = keys.map((_, i) => `theme${i}`);
      return `${imports.join("\n")}\nexport default [${names.join(", ")}];`;
    },
    transform(_code, id) {
      if (this.environment.name === "client" || !id.endsWith(moduleId)) {
        return;
      }

      if (isBuild) {
        if (Object.keys(built).length === 0) {
          this.error(
            "No theme CSS recorded; did Fresh change its build order?",
          );
        }
        return `export const THEME_ASSETS = ${JSON.stringify(built)};`;
      }

      // Dev: resolve per access, so a theme file added while the server runs
      // is picked up without a restart.
      return `
        const dir = ${JSON.stringify(`${root}/${THEMES_DIR}`)};
        const fontUrls = (css) => [...css.matchAll(${fontUrlRe.toString()})]
          .map((m) => m[1].replace("../", "/styles/"));
        const read = (key) => {
          if (typeof key !== "string") return undefined;
          try {
            const css = Deno.readTextFileSync(\`\${dir}/\${key}.css\`);
            return { css: \`/${THEMES_DIR}/\${key}.css\`, fonts: fontUrls(css) };
          } catch {
            return undefined;
          }
        };
        export const THEME_ASSETS = new Proxy({}, {
          get: (_, key) => read(key),
          has: (_, key) => read(key) !== undefined,
        });
      `;
    },
    async generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;

      const keys = await themeKeys();
      for (const output of Object.values(bundle)) {
        if (output.type !== "asset" || typeof output.source !== "string") {
          continue;
        }
        const key = keys.find((key) =>
          output.names.includes(`${key}.css`) ||
          output.originalFileNames.includes(`${THEMES_DIR}/${key}.css`)
        );
        if (!key) continue;

        built[key] = {
          css: `/${output.fileName}`,
          fonts: fontUrls(output.source),
        };
      }
    },
  };
}
