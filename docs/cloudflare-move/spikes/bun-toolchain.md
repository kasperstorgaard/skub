# Spike: Bun toolchain on the shared code

Rollout step 0, "Bun + Playwright + `bun test`", plus the toolchain parts of
step 1. Run on 2026-11-25 on branch `spike/bun-toolchain`, cut from
`plan/cloudflare-migration-research`. Throwaway: the files under
`spikes/bun-toolchain/` are evidence, not the step 1 implementation.

Only this write-up is copied to the plan branch. The code and evidence files
(`spikes/bun-toolchain/…`) stay on branch `spike/bun-toolchain` at `aab28efd`;
the paths below refer to that branch, not this one.

## Results

| Check                                                    | Result                                  | Evidence                                                                                                                                                                     |
| -------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Root `package.json` + `tsconfig.json` beside `deno.json` | Pass, with lockfile churn               | `deno test` 480/480, `deno lint`, `deno fmt --check`, `deno check`, `deno task build`, `deno task check-css` all pass. `deno.lock` gains the package.json deps (+567 lines). |
| `#/` alias and `@std/*` from npm under Bun               | Pass                                    | All 31 `game/` + `lib/` test files load. Every one fails only on `Deno.test`, not on resolution.                                                                             |
| `game/` + `lib/` tests under `bun test`, unchanged       | Fail (0 of 31)                          | Every file: `ReferenceError: Deno is not defined` at its first `Deno.test`.                                                                                                  |
| Same, with `Deno.test` swapped for `node:test`           | 24 of 31 files pass under both runtimes | Bun: 435 pass, 12 fail, 4 load errors in 7 files. Deno: 480/480. The 7 are listed below.                                                                                     |
| One test file serving both runtimes                      | Pass                                    | `import { test } from "node:test"`, no shims. The 5 sample files: Bun 147/147, Deno 147/147. A deliberate failure is reported by both.                                       |
| Temporal (`game/date.ts`, `game/url.ts`)                 | Pass                                    | Bun 1.4.5 has native Temporal. With it deleted and `temporal-polyfill/global` loaded: 35/35. Node 22 has none.                                                               |
| Oxlint on `game/` + `lib/`                               | Pass                                    | Default rules: 1 warning in 87 files, 44 ms. With `suspicious` + `perf`: 36 warnings.                                                                                        |
| Oxfmt on `game/` + `lib/`                                | Pass, but it disagrees with `deno fmt`  | Width 80: 54 of 88 files change (+2,097/−1,224 lines). After oxfmt, `deno fmt --check` fails on 24 files.                                                                    |
| Import rules as an Oxlint JS plugin                      | Pass                                    | Same violations and positions as `deno lint` on fixtures. The autofix matches Deno's after two `--fix` runs. The boundary rule flags 7 real imports in `game/`.              |
| TypeScript 7 `tsc --noEmit`                              | 38 errors, all Deno or Fresh            | 0 errors in the portable files. Details below.                                                                                                                               |
| Playwright under Bun                                     | Pass, Bun is the runtime                | `bunx --bun playwright test`: runner and worker both report Bun. Without `--bun`, both run on Node (shebang).                                                                |
| Script on `node:` APIs                                   | Pass                                    | `scripts/check-css.ts` on `node:fs/promises` + `node:process`: same output under `deno task check-css` and `bun`, and exits 1 when over budget.                              |
| CI sketch                                                | Drafted                                 | `spikes/bun-toolchain/ci-sketch.yml`. The YAML parses. It would be red today on the 7 test files, oxfmt and tsc.                                                             |

## Versions

Bun 1.4.5, Deno 2.9.8, Node 22.23.5 (the default `node` on PATH is 20.20.2),
oxlint 1.95.0, oxfmt 0.80.0, TypeScript 7.0.2, @playwright/test 1.59.1 (Chromium
1217, with `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64`),
temporal-polyfill 1.0.8, `@jsr/std__assert` 1.0.19, @types/bun 1.4.5.

## Shared core under Bun

- **Specifiers.** `package.json` aliases each JSR dep to the JSR npm mirror,
  e.g. `"@std/assert": "npm:@jsr/std__assert@^1.0.19"`, and `.npmrc` maps `@jsr`
  to `https://npm.jsr.io`. Shared code keeps its bare `@std/...` imports, and
  subpaths (`@std/http/cookie`, `@std/assert/equals`) resolve through the
  package exports. `#/` comes from tsconfig `paths`, which Bun reads at runtime.
- **Deno sees `package.json`.** Every Deno command still passes, but:
  - `deno.lock` records the package.json deps. That's +567 lines, purely
    additive once versions are pinned.
  - Deno and Bun share one `node_modules` (467 MB, with Deno's `.deno` dir
    inside). Both work.
  - **Version skew trap.** An unpinned `@playwright/test@^1.65.1` moved Deno's
    `npm:playwright@^1.59.1` from 1.59.1 to 1.65.1 in `deno.lock`, and that
    version needs a different Chromium. Pinning it to 1.59.1 fixed this. Any dep
    both sides use must have the same version in both files.
- **Where `package.json` lives.** Bun resolves a bare specifier by walking up
  from the importing file, so `game/*.ts` at the repo root needs a root
  `node_modules`. If the new app is a Bun workspace in its own directory, the
  root `package.json` is the workspace root (`"workspaces": ["<app dir>"]`) and
  holds the shared deps. An app-local `package.json` alone won't resolve
  `@std/*` for `game/`.

### Porting the tests

The cheapest port that serves both runtimes is **`node:test`**, not `bun:test`:

```ts
import { assertEquals } from "@std/assert";
import { test } from "node:test";

test("...", () => { ... });
```

- `bun:test` fails under Deno: "Unsupported scheme bun". It does work if
  `deno.json` maps it to a 3-line shim (`"bun:test": "./…/bun-test-for-deno.ts"`
  exporting `test = Deno.test`), which also gave 147/147 on both runtimes. But
  `node:test` needs no shim, no import map entry, and no new file.
- The swap is mechanical: `Deno.test(` → `test(` plus one import line, done by
  `spikes/bun-toolchain/port-node-test.sh`. Every shared test uses only
  `Deno.test("name", fn)`. One file (`names_test.ts`) needed `deno lint
  --fix`
  for import order afterwards.
- All 31 files were ported to measure the result. The branch commits only the
  5-file sample: `game/board`, `date`, `url`, `streak`, `lib/list`.

The 7 `game/`/`lib/` files that still fail under Bun after the swap:

| File                                                          | Cause                                                                                                 | Fix                                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `game/flash_test.ts`                                          | The test reads a puzzle with `Deno.readTextFile`                                                      | `readFile` from `node:fs/promises`. Tried: passes on both.                                        |
| `lib/themes_test.ts`                                          | The test reads CSS with `Deno.readTextFileSync`                                                       | `readFileSync` from `node:fs`. Tried: passes on both.                                             |
| `game/names_test.ts`                                          | `game/names.ts` uses `Deno.cwd` + `Deno.readTextFileSync`                                             | `import names from "#/game/danish-names.json" with { type: "json" }`. Works on both.              |
| `game/recommendation_test.ts`, `game/candidate-store_test.ts` | Both import `game/loader.ts`, which imports `lib/env.ts` (`Deno.env`) and reads the puzzles from disk | Step 1's injected puzzle source. `candidate-store.ts` also uses Deno fs (authoring tool, step 4). |
| `lib/signed-cookie_test.ts`                                   | `lib/signed-cookie.ts` imports `lib/env.ts`                                                           | The new env module (step 2). Signing itself is `crypto.subtle` and portable.                      |
| `lib/kv-json_test.ts`                                         | `Deno.KvU64`, `Deno.KvKey`                                                                            | Deno-only by nature. The KV → SQL import needs its own decoder for `$u64`.                        |

### Extrapolated to all 45 test files

| Group                                                                                   | Files | Effort                                                                                                                                        |
| --------------------------------------------------------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Mechanical swap, passes on both                                                         |    25 | One scripted commit (24 in `game/`/`lib/`, plus `client/touch_test.ts`).                                                                      |
| Test reads files through Deno                                                           |     2 | Minutes each.                                                                                                                                 |
| Blocked on source changes already in step 1                                             |     3 | The JSON import for names (1 line). The injected puzzle source for `loader.ts`.                                                               |
| Server-only (`lib/env`, Deno KV)                                                        |     2 | Stays Deno-only, or follows the new env module. Not shared code.                                                                              |
| Deno-app tooling (`db/backup-keys`, `scripts/lib/blast-radius`, `plugins/lint-imports`) |     3 | Stays on Deno. `lint-imports_test.ts` (`Deno.lint.runPlugin`) gets a new twin on Oxlint's `RuleTester` (`oxlint/plugins-dev`).                |
| E2E (`e2e/`, `routes/**/_e2e/`)                                                         |    10 | Not a runner swap. They drive the Playwright library inside `Deno.test`, and the move to `@playwright/test` is its own harness item (step 2). |

So step 1's "unit tests runnable by `bun test`" is about half a day for the 30
shared files. Nearly all of it is the loader/names source work the plan already
lists.

## Temporal

- Bun 1.4.5 ships Temporal natively: `typeof Temporal === "object"`, and
  `PlainDate.until` gives correct day counts.
- With native Temporal deleted and `temporal-polyfill/global` loaded through a
  preload (`spikes/bun-toolchain/temporal-polyfill-preload.ts`),
  `game/date_test.ts` + `game/url_test.ts` pass 35/35.
- Node 22 has no Temporal. workerd wasn't tested here. The plan's "polyfill
  where the runtime lacks it" holds; on Bun it's not needed.
- TypeScript 7's `ESNext` lib types Temporal, so tsc reports no errors for it.

## Lint and format

### Oxlint (built-in rules)

- **Default (`correctness`):** 96 rules, 87 files, 1 warning (`no-unused-vars`
  on a `_` parameter in `game/skill_test.ts`), 44 ms.
- **Adding `suspicious` + `perf`:** 135 rules, 36 warnings:
  - 13 `unicorn/no-array-sort` and 1 `no-array-reverse` (prefer `toSorted`)
  - 4 `oxc/no-map-spread`, 3 `no-await-in-loop`, 3 `no-shadow`, 3
    `prefer-add-event-listener`, 3 `require-post-message-target-origin` (the
    solver worker), 3 `consistent-function-scoping`, and one each of
    `no-accumulating-spread`, `no-useless-constructor`, `no-unused-vars`
- Low noise. Start with `correctness` and opt into others deliberately.

### Oxfmt

- **With defaults** (Prettier-compatible, width 100): 73 of 88 files change.
- **At `printWidth: 80`:** 54 files change, +2,097/−1,224 lines. The differences
  from `deno fmt` (dprint):
  - Multi-line call arguments get trailing commas.
  - Intersection types are laid out differently.
  - Prettier's parenthesised multi-line `return (…)`.
  - Short type unions are joined onto one line.
- **`trailingComma: "es5"`** makes it worse: 71 files.
- **The two can't both own a file.** After oxfmt, `deno fmt --check` still fails
  24 files, so shared code needs exactly one formatter until the Deno app is
  deleted.

### Import rules as an Oxlint JS plugin

`spikes/bun-toolchain/oxlint-skub-imports.ts` with
`spikes/bun-toolchain/oxlintrc.json`. The rule bodies of
`plugins/lint-imports.ts` carry over almost line for line: ESLint-style
`create(context)`, `context.report({ fix })`, `fixer.replaceText` /
`replaceTextRange`, `sourceCode.getText`, `node.range`. Each fixable rule needs
`meta: { fixable: "code" }`.

- **`use-hash-alias` and `import-order`.** On two fixture files with relative
  cross-folder imports and misordered groups, Oxlint reports the same 4
  violations at the same line:column as `deno lint`.
- **Autofix.**
  - `deno lint --fix` loops until stable. `oxlint --fix` applies one
    non-overlapping pass per run. When the alias fix sits inside the
    import-order range, the first run fixes the order only.
  - A second `--fix` run gives byte-identical output to Deno's. Run it twice in
    a `lint:fix` script.
- **`game-boundary` (new).** It fires for any file under `game/`:
  - Imports, through `#/` or a relative path, of `db/`, `routes/`,
    `middleware/`, `core.ts`, `lib/env.ts`, `lib/{signed,auth,user}-cookie.ts`
    or `lib/kv-json.ts`.
  - Any `Deno.env` or `process.env`.
  - Type-only imports pass, because they're erased from the bundle.
  - On today's code it flags 7 real violations:
    - `lib/env.ts`, imported by `loader`, `solver-queue`, `profile-cookie` and
      `progress-cookie`
    - `lib/signed-cookie.ts`, imported by both cookie modules
    - `Deno.env` in `game/cookies.ts`
  - So the cookie modules have to move out of `game/` (or get split) in step 1.
  - Limit: the rule is per file, so it doesn't see transitive imports, e.g.
    `game/` → `lib/x.ts` → `lib/env.ts`. Add each module like that to the list.
- **Runtime.**
  - The plugin is TypeScript. It loads under `bunx --bun oxlint` (Bun) and on
    Node 22.23.
  - It fails on Node 20 (no type stripping). Oxlint documents Node ≥ 22.18.
  - JS plugins are marked alpha and not under semver: pin oxlint.
- **Ignore comments.** Oxlint doesn't read `// deno-lint-ignore-file`. It
  reports `lib/manifest.ts`, the one shared file that carries it. Shared code
  needs `oxlint-disable` comments, or no ignores at all.
- **Biome 2:** not tried. Oxlint did everything it needed to.

## Type check (TypeScript 7)

`tsc --noEmit -p tsconfig.json` over `game/**` + `lib/**` takes 0.2 s, giving
**38 errors in 13 files**:

| Kind                                  | Count | Where                                                                                                                    |
| ------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------------ |
| TS2304 `Cannot find name 'Deno'`      |    29 | `candidate-store`, `loader`, `names`, `cookies`, `env`, `email`, `posthog`, `signed-cookie`, `manifest`                  |
| TS2503 `Cannot find namespace 'Deno'` |     4 | `kv-json` (+ test)                                                                                                       |
| TS18046 `… is of type 'unknown'`      |     3 | Knock-on effects of the missing `Deno` types                                                                             |
| TS2307 `Cannot find module 'fresh'`   |     1 | `core.ts`, through `import type { State }` in `lib/tracking.ts`                                                          |
| TS2339 `ReadableStream.from`          |     1 | `lib/deflate.ts`. The DOM lib lacks `ReadableStream.from`; workers types (`@cloudflare/workers-types`) or a cast fix it. |

- Files with no Deno or Fresh dependency type-check clean, Temporal included.
- With `verbatimModuleSyntax: true`, add 32 TS1484 ("must use `import type`"),
  all autofixable. The spike's tsconfig turns it off. Turning it on is a one-off
  `import type` sweep (Oxlint's `consistent-type-imports` should autofix it; not
  tried).
- Deno ignored the root `tsconfig.json`. With `verbatimModuleSyntax: true` set,
  `deno test` still passed.

## Playwright under Bun

`spikes/bun-toolchain/playwright/` holds one `@playwright/test` spec against a
static `file://` page (Chromium headless), with no server.

- `bunx --bun playwright test -c …/playwright.config.ts`: 1 passed in 354 ms.
  The config logs "runner: bun", and the test logs "worker: bun 1.4.5". Bun is
  really the runtime.
- Plain `bunx playwright test` follows the `#!/usr/bin/env node` shebang: runner
  and worker are Node 20.20.2. CI must pass `--bun`, or it silently runs on
  whatever Node is on the PATH.

## Scripts

`scripts/check-css.ts` was ported in place:

- `Deno.readDir` → `readdir(…, { withFileTypes: true })`
- `Deno.readTextFile` → `readFile(…, "utf8")`
- `Deno.exit` → `process.exit`, imported from `node:process`

It's a 6-line diff. `deno task check-css` and `bun scripts/check-css.ts` both
print "Entry CSS is 15.4 KB gzipped; all CSS variables resolve." With the budget
lowered, Bun exits 1 with the same message. Scripts that only touch files can
share one source with `node:` APIs, with no Bun-specific API.

## Timings (local, warm)

| Step                              | Time                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------- |
| `bun test` on 31 files, 447 tests | 1.3–1.7 s (unchanged files, run with a `Deno.test` preload shim for timing only) |
| `deno test`, 480 tests            | 3.7 s with type check, 2.9 s `--no-check`                                        |
| `oxlint` with the JS plugin       | 91 ms                                                                            |
| `oxlint` without the JS plugin    | 44 ms                                                                            |
| `oxfmt --check`                   | 102 ms                                                                           |
| `deno lint`                       | 103 ms                                                                           |
| `tsc` (TS 7)                      | 184 ms                                                                           |

## Recommendation

Keep the plan's toolchain: Bun, `bun test`, Oxlint + Oxfmt and TypeScript 7.
Nothing here calls for Vitest or Biome. Refinements:

1. **Shared tests import `test` from `node:test`.** Not from `bun:test`, and not
   through a shim. One file then runs under `deno test` and `bun test`
   unchanged. Record this in harness.md ("Shared tests under `bun test`").
2. **The root `package.json` is the Bun workspace root.** It holds the shared
   deps, aliasing JSR to `npm:@jsr/…` through `.npmrc`. The new app is a
   workspace member. Pin every dep that `deno.json` also lists to the same
   version, and accept the additive `deno.lock` churn once.
3. **One formatter per file until cleanup.** `deno fmt` and Oxfmt can't agree.
   Suggested: `deno fmt` keeps owning the shared code and the Deno app; Oxfmt
   owns the new app's directory and ignores `game/`/`lib/`; reformat shared code
   once when the Deno app is deleted. The alternative is reformatting now (54
   files) and swapping `deno fmt --check` for Oxfmt in the Deno CI. **This needs
   a decision.**
4. **The boundary rule forces an early move.** `game/cookies.ts`,
   `progress-cookie.ts` and `profile-cookie.ts` sign cookies and read env,
   `loader.ts` and `solver-queue.ts` read `isDev`. In step 1 they move to server
   code, or take env and signing as parameters, before the rule can be on.
5. **Pin Oxlint and run `--fix` twice.** JS plugins are alpha, and a single
   `oxlint --fix` run doesn't apply overlapping fixes.
6. **Always `bunx --bun`** for Playwright and for Oxlint with a TS plugin.
   Otherwise the shebang picks up whatever Node is installed.
7. Temporal needs no polyfill on Bun. Keep the polyfill for workerd until the
   Astro spike confirms workerd's status.
