/**
 * Prints the e2e test files affected by this branch, space-separated.
 * Prints nothing when no e2e test is affected. Any failure exits non-zero.
 *
 * Usage: deno run -A scripts/select-e2e-tests.ts
 * Env:   DEPLOY_SHA — commit to compare against origin/main (default HEAD)
 */

import {
  classifyFile,
  getBlastRadius,
  type ImportGraph,
} from "#/scripts/lib/blast-radius.ts";

type DenoInfo = {
  roots: string[];
  redirects: Record<string, string>;
  modules: {
    specifier: string;
    local?: string;
    error?: string;
    dependencies?: {
      code?: { specifier: string };
      type?: { specifier: string };
    }[];
  }[];
};

const REPO = Deno.cwd();

// stdout is the file list; everything else goes to stderr
const log = (line: string) => console.error(line);

async function run(command: string, args: string[]): Promise<string> {
  const result = await new Deno.Command(command, {
    args,
    stdout: "piped",
    stderr: "piped",
  }).output();

  if (!result.success) {
    const stderr = new TextDecoder().decode(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed:\n${stderr}`);
  }

  return new TextDecoder().decode(result.stdout);
}

async function getChangedFiles(): Promise<string[]> {
  const sha = Deno.env.get("DEPLOY_SHA") || "HEAD";
  const output = await run("git", [
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    `origin/main...${sha}`,
  ]);
  return output.split("\0").filter(Boolean);
}

async function collectRoots(dir: string, roots: string[]): Promise<void> {
  for await (const entry of Deno.readDir(dir)) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) {
      await collectRoots(path, roots);
    } else if (/\.tsx?$/.test(entry.name)) {
      const isTest = entry.name.endsWith("_test.ts");
      const isE2e = path.startsWith("e2e/") || path.includes("/_e2e/");
      if (isE2e ? isTest : !isTest) roots.push(path);
    }
  }
}

function toRepoPath(specifier: string): string | null {
  if (!specifier.startsWith("file://")) return null;
  const path = decodeURIComponent(new URL(specifier).pathname);
  return path.startsWith(`${REPO}/`) ? path.slice(REPO.length + 1) : null;
}

/** One `deno info` over a generated module importing every root. */
async function buildGraph(roots: string[]): Promise<ImportGraph> {
  const dir = await Deno.makeTempDir();
  try {
    const entry = `${dir}/entry.ts`;
    const imports = roots.map((root) =>
      `import ${JSON.stringify(new URL(`file://${REPO}/${root}`).href)};`
    );
    await Deno.writeTextFile(entry, imports.join("\n"));

    const info: DenoInfo = JSON.parse(
      await run("deno", [
        "info",
        "--json",
        "--config",
        `${REPO}/deno.json`,
        entry,
      ]),
    );

    const resolve = (specifier: string) =>
      info.redirects[specifier] ?? specifier;
    const deps = new Map<string, string[]>();
    for (const module of info.modules) {
      if (module.error) {
        throw new Error(`${module.specifier}: ${module.error}`);
      }
      deps.set(
        module.specifier,
        (module.dependencies ?? []).flatMap((dep) =>
          [dep.code?.specifier, dep.type?.specifier]
            .filter((specifier) => specifier !== undefined)
            .map(resolve)
        ),
      );
    }

    const graph: ImportGraph = {};
    for (const root of roots) {
      const start = new URL(`file://${REPO}/${root}`).href;
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length > 0) {
        const current = queue.pop() ?? "";
        for (const next of deps.get(current) ?? []) {
          if (seen.has(next) || toRepoPath(next) === null) continue;
          seen.add(next);
          queue.push(next);
        }
      }
      graph[root] = [...seen].flatMap((specifier) =>
        toRepoPath(specifier) ?? []
      );
    }
    return graph;
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

const roots: string[] = [];
await collectRoots("routes", roots);
await collectRoots("e2e", roots);

const [changedFiles, graph] = await Promise.all([
  getChangedFiles(),
  buildGraph(roots),
]);

if (!Object.keys(graph).some((root) => root.endsWith("_test.ts"))) {
  throw new Error("No e2e test files found");
}

log(`Changed files (${changedFiles.length}):`);
for (const file of changedFiles) {
  log(`  ${(classifyFile(file) ?? "????").padEnd(4)}  ${file}`);
}

const files = getBlastRadius(changedFiles, graph);

log(`\nSelected e2e tests (${files.length}):`);
for (const file of files) log(`  ${file}`);

if (files.length > 0) console.log(files.join(" "));
