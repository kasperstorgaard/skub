import { gzipSync } from "node:zlib";

/**
 * Checks the built CSS stays under its gzipped budget, and that every
 * `var(--…)` in it and in UI source resolves to a declared custom property.
 * Unresolved vars fail silently in the browser.
 *
 * Usage: `deno task build && deno task check-css`
 */
const BUDGET_KB = 14;
const ASSETS_DIR = "_fresh/client/assets";
const SOURCE_DIRS = ["components", "islands", "routes", "client", "lib"];

// Unresolved on main before this check existed.
const KNOWN = new Set(["--size-fluid-0"]);

async function* files(dir: string, ext: RegExp): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) yield* files(path, ext);
    else if (ext.test(entry.name)) yield path;
  }
}

let css = "";
for await (const path of files(ASSETS_DIR, /\.css$/)) {
  css += await Deno.readTextFile(path);
}
if (!css) {
  console.error(`No CSS in ${ASSETS_DIR}; run \`deno task build\` first.`);
  Deno.exit(1);
}

const gzippedKb = gzipSync(css).length / 1024;
if (gzippedKb > BUDGET_KB) {
  console.error(
    `CSS is ${
      gzippedKb.toFixed(1)
    } KB gzipped, over the ${BUDGET_KB} KB budget.`,
  );
  Deno.exit(1);
}

let source = "";
for (const dir of SOURCE_DIRS) {
  for await (const path of files(dir, /(?<!_test)\.tsx?$/)) {
    source += await Deno.readTextFile(path);
  }
}

const declared = new Set<string>();
for (const [, name, value] of css.matchAll(/(--[\w-]+)\s*:([^;}]*)/g)) {
  // `--x: var(--x)` is a cycle, not a definition
  if (value.trim() !== `var(${name})`) declared.add(name);
}
for (const [, name] of css.matchAll(/@property\s+(--[\w-]+)/g)) {
  declared.add(name);
}
// Inline style keys and setProperty calls
for (const [, name] of source.matchAll(/["'`](--[\w-]+)["'`]/g)) {
  declared.add(name);
}

const unresolved = new Set<string>();
for (const text of [css, source]) {
  // A fallback, `var(--x, …)`, means the author expects it to be unset
  for (const [, name] of text.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
    if (name.startsWith("--_") || KNOWN.has(name)) continue;
    if (!declared.has(name)) unresolved.add(name);
  }
}

if (unresolved.size) {
  console.error("Unresolved CSS variables:");
  for (const name of [...unresolved].sort()) console.error(`  ${name}`);
  Deno.exit(1);
}
console.log(
  `CSS is ${gzippedKb.toFixed(1)} KB gzipped; all CSS variables resolve.`,
);
