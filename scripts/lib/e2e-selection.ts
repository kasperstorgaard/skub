/** Repo-relative files each root module reaches through its imports, itself included. */
export type ImportGraph = Record<string, string[]>;

const IGNORED = [
  /^\.claude\//,
  /^(?!static\/puzzles\/).*\.md$/,
  /^(?!e2e\/)(?!.*\/_e2e\/).*_test\.ts$/,
];

const SHARED_ENTRY_POINTS = [
  /^main\.ts$/,
  /^client\.ts$/,
  /^core\.ts$/,
  /^routes\/_app\.tsx$/,
  /^routes\/(.*\/)?_(layout|middleware)[^/]*$/,
  /^middleware\//,
  /^deno\.(json|lock)$/,
  /^vite\.config\.ts$/,
  /^plugins\//,
  /\.css$/,
  /^\.github\/workflows\/e2e\.yml$/,
  /^scripts\/select-e2e-tests\.ts$/,
  /^scripts\/lib\/e2e-selection\.ts$/,
];

const PUZZLE_CONTENT = /^static\/puzzles\//;
const PUZZLE_ROUTES = "routes/puzzles/";

const ROUTE_TEST = /^routes\/(.*\/)?_e2e\/[^/]+_test\.ts$/;
const FLOW_TEST = /^e2e\/[^/]+_test\.ts$/;
const ROUTE_MODULE = /^routes\/(?!(.*\/)?_e2e\/).*\.tsx?$/;

/**
 * Picks the e2e test files a change can break: a route's nearest `_e2e/`
 * tests when the route or anything it imports changed, plus the `e2e/` flows.
 * Graph roots are route modules and e2e test files.
 */
export function selectE2eTests(
  changedFiles: string[],
  graph: ImportGraph,
): string[] {
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
    if (IGNORED.some((pattern) => pattern.test(file))) continue;

    if (SHARED_ENTRY_POINTS.some((pattern) => pattern.test(file))) {
      return [...tests].sort();
    }

    if (PUZZLE_CONTENT.test(file)) {
      routeAffected = true;
      for (const test of routeTests) {
        if (test.startsWith(PUZZLE_ROUTES)) selected.add(test);
      }
      continue;
    }

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

  return [...selected].sort();
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
