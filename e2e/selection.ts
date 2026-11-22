/**
 * How a changed file affects e2e selection. First matching glob wins; a file
 * matching nothing fails the selection.
 *
 * - none: can't change what a player sees
 * - full: shared by every page, runs every e2e test
 * - dep: runs the tests that reach it through the import graph
 */
export type SelectionOutcome = "none" | "full" | "dep";

export type SelectionRule = [glob: string, outcome: SelectionOutcome];

export const E2E_SELECTION: SelectionRule[] = [
  ["static/puzzles/**", "none"],

  ["e2e/selection.ts", "full"],
  ["scripts/select-e2e-tests.ts", "full"],
  ["scripts/lib/e2e-selection.ts", "full"],
  [".github/workflows/e2e.yml", "full"],

  ["e2e/**/*_test.ts", "dep"],
  ["**/_e2e/**", "dep"],
  ["**/*_test.ts", "none"],
  ["**/*.md", "none"],
  ["**/.DS_Store", "none"],

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

  ["specs/**", "none"],
  [".claude/**", "none"],
  ["candidates/**", "none"],
  ["scripts/**", "none"],
  [".github/**", "none"],
  [".vscode/**", "none"],
  ["LICENSE", "none"],
  [".gitignore", "none"],
  [".claudeignore", "none"],
  [".mcp.json", "none"],
  ["paseo.json", "none"],
  ["ricochet.code-workspace", "none"],
  ["skills-lock.json", "none"],

  ["routes/**", "dep"],
  ["islands/**", "dep"],
  ["components/**", "dep"],
  ["game/**", "dep"],
  ["client/**", "dep"],
  ["lib/**", "dep"],
  ["db/**", "dep"],
  ["e2e/**", "dep"],
];
