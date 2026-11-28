import { globToRegExp } from "@std/path";

import config from "#/e2e/blast-radius.config.ts";

/** Repo-relative files each root module reaches through its imports, itself included. */
export type ImportGraph = Record<string, string[]>;

export type BlastRadiusConfig = [
  glob: string,
  outcome: "none" | "full" | "dep",
][];

const MATCHERS = config.map(([glob, outcome]) => ({
  pattern: globToRegExp(glob, { globstar: true, extended: true }),
  outcome,
}));

/** The config outcome of the first glob a file matches, if any. */
export function classifyFile(file: string) {
  return MATCHERS.find(({ pattern }) => pattern.test(file))?.outcome;
}

const ROUTE_TEST = /^routes\/(.*\/)?_e2e\/[^/]+_test\.ts$/;
const FLOW_TEST = /^e2e\/[^/]+_test\.ts$/;
const ROUTE_MODULE = /^routes\/(?!(.*\/)?_e2e\/)(?!.*_test\.ts$).*\.tsx?$/;

/**
 * The e2e test files a change can break, per `e2e/blast-radius.config.ts`.
 * A dep file runs the nearest `_e2e/` tests of each route reaching it, plus
 * the `e2e/` flows. Graph roots are route modules and e2e test files.
 */
export function getBlastRadius(
  changedFiles: string[],
  graph: ImportGraph,
): string[] {
  const unclassified = changedFiles.filter((file) => !classifyFile(file));
  if (unclassified.length > 0) {
    throw new Error(
      `Unclassified changed files, add them to e2e/blast-radius.config.ts: ${
        unclassified.join(", ")
      }`,
    );
  }

  const roots = Object.keys(graph);
  const tests = roots.filter((root) =>
    ROUTE_TEST.test(root) || FLOW_TEST.test(root)
  );
  const routeTests = tests.filter((test) => ROUTE_TEST.test(test));
  const flowTests = tests.filter((test) => FLOW_TEST.test(test));

  const selected = new Set<string>();
  let routeAffected = false;

  const addRoute = (route: string) => {
    routeAffected = true;
    for (const test of nearestRouteTests(route, routeTests)) {
      selected.add(test);
    }
  };

  for (const file of changedFiles) {
    const outcome = classifyFile(file);
    if (outcome === "none") continue;
    if (outcome === "full") return tests.toSorted();

    // Covers deleted routes too, which are no longer in the graph.
    if (ROUTE_MODULE.test(file)) addRoute(file);

    for (const root of roots) {
      if (!graph[root].includes(file)) continue;
      if (ROUTE_TEST.test(root) || FLOW_TEST.test(root)) selected.add(root);
      else if (ROUTE_MODULE.test(root)) addRoute(root);
    }
  }

  if (routeAffected) {
    for (const test of flowTests) selected.add(test);
  }

  return [...selected].toSorted();
}

/** The tests in the closest `_e2e/` folder at or above the route's folder. */
function nearestRouteTests(route: string, routeTests: string[]): string[] {
  const parts = route.split("/").slice(0, -1);

  while (parts.length > 0) {
    const prefix = `${parts.join("/")}/_e2e/`;
    const found = routeTests.filter((test) => test.startsWith(prefix));
    if (found.length > 0) return found;
    parts.pop();
  }

  return [];
}
