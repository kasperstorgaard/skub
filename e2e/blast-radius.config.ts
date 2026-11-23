import type { BlastRadiusConfig } from "#/scripts/lib/blast-radius.ts";

/**
 * Which e2e tests a changed file runs. First match wins; a changed file
 * matching nothing fails the check.
 *
 * - none: can't change what a player sees
 * - full: shared by every page, runs every test
 * - dep: runs the tests that reach it through the import graph; unit tests
 *   land here too and select nothing, since no route imports them
 */
export default [
  // The selector itself, in folders that otherwise run nothing
  ["e2e/blast-radius.config.ts", "full"],
  ["scripts/select-e2e-tests.ts", "full"],
  ["scripts/lib/blast-radius.ts", "full"],
  [".github/workflows/e2e.yml", "full"],

  ["static/puzzles/**", "none"],
  ["**/*.md", "none"],
  ["**/.DS_Store", "none"],
  ["specs/**", "none"],
  [".claude/**", "none"],
  ["candidates/**", "none"],
  ["scripts/**", "none"],
  [".github/**", "none"],
  [".vscode/**", "none"],
  ["plugins/**/*_test.ts", "none"],
  ["LICENSE", "none"],
  [".gitignore", "none"],
  [".claudeignore", "none"],
  [".mcp.json", "none"],
  ["paseo.json", "none"],
  ["ricochet.code-workspace", "none"],
  ["skills-lock.json", "none"],

  ["main.ts", "full"],
  ["client.ts", "full"],
  ["core.ts", "full"],
  ["routes/_app.tsx", "full"],
  ["**/_layout*", "full"],
  ["**/_middleware*", "full"],
  ["middleware/**", "full"],
  ["deno.json", "full"],
  ["deno.lock", "full"],
  ["vite.config.ts", "full"],
  ["plugins/**", "full"],
  ["**/*.css", "full"],
  ["styles/**", "full"],
  ["static/**", "full"],

  ["routes/**", "dep"],
  ["islands/**", "dep"],
  ["components/**", "dep"],
  ["game/**", "dep"],
  ["client/**", "dep"],
  ["lib/**", "dep"],
  ["db/**", "dep"],
  ["e2e/**", "dep"],
] satisfies BlastRadiusConfig;
