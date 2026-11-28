type ImportGroup = "third-party" | "project";

export default {
  name: "skub-imports",
  rules: {
    /**
     * All cross-folder project imports must use the #/ alias.
     * Same-folder relative imports (e.g. ./board.ts) are allowed.
     *
     * TODO: skip this rule for _e2e/ files — POM-to-POM imports use relative
     * paths to keep the e2e import graph readable.
     */
    "use-hash-alias": {
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value;

            if (getImportGroup(source) === "third-party") return;
            if (source.startsWith("#/")) return;

            // Allow same-folder: ./filename.ext (no nested path)
            if (source.startsWith("./") && !source.slice(2).includes("/")) {
              return;
            }

            context.report({
              node: node.source,
              message: `Use '#/' alias instead of relative path: "${source}"`,
              fix(fixer) {
                const matcher = /((?:[.]{0,2}\/)+)(.*)/;
                const corrected = source.replace(matcher, '"#/$2"');

                return fixer.replaceText(node.source, corrected);
              },
            });
          },
        };
      },
    },

    /**
     * Imports must form two groups separated by exactly one blank line:
     *   1. Third-party (bare specifiers, npm:, jsr:, etc.), sorted alphabetically
     *   2. Project (#/ and same-folder ./), sorted alphabetically
     * No blank lines are allowed within a group.
     */
    "import-order": {
      create(context) {
        return {
          Program(node) {
            const sourceCode = context.sourceCode;
            const body = node.body as Deno.lint.Node[];

            const importIndices: number[] = [];
            for (let i = 0; i < body.length; i++) {
              if (body[i].type === "ImportDeclaration") importIndices.push(i);
            }

            // Gather consecutive import declarations into blocks
            const blocks: Deno.lint.ImportDeclaration[][] = [];
            let current: Deno.lint.ImportDeclaration[] = [];

            for (let i = 0; i < importIndices.length; i++) {
              if (i > 0 && importIndices[i] - importIndices[i - 1] > 1) {
                blocks.push(current);
                current = [];
              }

              current.push(
                body[importIndices[i]] as Deno.lint.ImportDeclaration,
              );
            }

            if (current.length > 0) blocks.push(current);

            for (const blockImports of blocks) {
              const { range, text: canonical } = rebuildImports(
                blockImports,
                (imp) => sourceCode.getText(imp),
              );

              if (sourceCode.text.slice(range[0], range[1]) === canonical) {
                continue;
              }

              context.report({
                node: blockImports[0],
                message: [
                  "Group imports by third party and project scope, separated by a newline and sorted.",
                  "",
                  "example:",
                  "```",
                  'import clsx from "clsx/lite";',
                  'import { HttpError, page } from "fresh";',
                  "",
                  'import { define } from "#/core.ts";',
                  'import { resolveMoves } from "#/game/board.ts";',
                  "```",
                ].join("\n"),
                fix(fixer) {
                  return fixer.replaceTextRange(range, canonical);
                },
              });
            }
          },
        };
      },
    },
  },
} satisfies Deno.lint.Plugin;

function getImportGroup(specifier: string): ImportGroup {
  if (
    specifier.startsWith("#/") ||
    specifier.startsWith("./") ||
    specifier.startsWith("../") ||
    specifier.startsWith("/")
  ) {
    return "project";
  }
  return "third-party";
}

/**
 * Rebuilds a contiguous block of import declarations into canonical form:
 * third-party imports first (sorted alphabetically), one blank line,
 * then project imports (sorted alphabetically).
 * Returns the range to replace and the replacement text.
 */
function rebuildImports(
  imports: Deno.lint.ImportDeclaration[],
  getText: (node: Deno.lint.ImportDeclaration) => string,
) {
  const range: [number, number] = [
    imports[0].range[0],
    imports[imports.length - 1].range[1],
  ];

  const sortImports = (imports: Deno.lint.ImportDeclaration[]) =>
    [...imports].sort((a, b) =>
      a.source.value.toLowerCase().localeCompare(b.source.value.toLowerCase())
    );

  const thirdPartyImports = sortImports(
    imports.filter((imp) => getImportGroup(imp.source.value) === "third-party"),
  );
  const projectImports = sortImports(
    imports.filter((imp) => getImportGroup(imp.source.value) === "project"),
  );

  const importGroups = [thirdPartyImports, projectImports].filter((group) =>
    group.length > 0
  );

  const text = importGroups
    .map((group) => group.map(getText).join("\n"))
    .join("\n\n");

  return { range, text };
}
