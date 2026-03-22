/**
 * AI-driven e2e test selection.
 *
 * Reads the git diff for the deployed SHA and the full content of each e2e
 * test file, asks Claude which tests are affected, and prints a
 * space-separated list of file paths to stdout.
 * Prints nothing (exit 0) if no tests are needed — the caller should skip.
 *
 * Usage: deno run -A scripts/select-e2e-tests.ts
 * Env:   DEPLOY_SHA  — git SHA from the Deno Deploy dispatch payload
 */

import Anthropic from "npm:@anthropic-ai/sdk@^4";

const TEST_FILE_PATHS = [
  "e2e/new-user-flow_test.ts",
  "e2e/returning-user-flow_test.ts",
  "e2e/puzzle_test.ts",
  "e2e/profile_test.ts",
];

async function getDiff(): Promise<string> {
  const sha = Deno.env.get("DEPLOY_SHA");
  const range = sha ? `origin/main...${sha}` : "origin/main...HEAD";

  const result = await new Deno.Command("git", {
    args: ["diff", range, "--unified=0"],
    stdout: "piped",
    stderr: "piped",
  }).output();

  return new TextDecoder().decode(result.stdout).trim();
}

async function readTestFiles(): Promise<string> {
  const sections = await Promise.all(
    TEST_FILE_PATHS.map(async (path) => {
      const content = await Deno.readTextFile(path);
      return `=== ${path} ===\n${content}`;
    }),
  );
  return sections.join("\n\n");
}

async function readSpec(): Promise<string | null> {
  try {
    return await Deno.readTextFile("spec.md");
  } catch {
    return null;
  }
}

const [diff, testFiles, spec] = await Promise.all([
  getDiff(),
  readTestFiles(),
  readSpec(),
]);

if (!diff) {
  Deno.exit(0);
}

const client = new Anthropic();

const specSection = spec
  ? `Here is the spec describing what this PR intends to build:\n\n${spec}\n\n`
  : "";

const response = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 256,
  output_config: {
    format: {
      type: "json",
      json_schema: {
        name: "test_selection",
        schema: {
          type: "object",
          properties: {
            files: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: ["files"],
          additionalProperties: false,
        },
      },
    },
  },
  messages: [
    {
      role: "user",
      content: `${specSection}Here is the git diff for this deployment:

${diff}

Here are the e2e test files and their full contents:

${testFiles}

Return the test files that should run given what changed.
Return an empty array if no e2e tests are needed — for example if only CSS,
static assets, puzzle data files, or documentation changed.`,
    },
  ],
});

const block = response.content[0];
if (block.type !== "text") Deno.exit(0);

const { files } = JSON.parse(block.text) as { files: string[] };

if (files.length > 0) {
  console.log(files.join(" "));
}
