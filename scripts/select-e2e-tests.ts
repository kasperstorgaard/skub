/**
 * AI-driven e2e test selection.
 *
 * Reads the git diff for the deployed SHA and the full content of each e2e
 * test file, asks Claude which tests are affected, and prints a
 * space-separated list of file paths to stdout.
 * Prints nothing (exit 0) if no tests are needed — the caller should skip.
 *
 * Usage: deno run -A scripts/select-e2e-tests.ts
 * Env:   DEPLOY_SHA      — git SHA from the Deno Deploy dispatch payload
 *        PR_DESCRIPTION  — PR body from GitHub API (optional, improves selection)
 */

import Anthropic from "@anthropic-ai/sdk";

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
  const paths = Array.from(Deno.readDirSync("e2e"))
    .filter((e) => e.isFile && e.name.endsWith("_test.ts"))
    .map((e) => `e2e/${e.name}`);

  const sections = await Promise.all(
    paths.map(async (path) => {
      const content = await Deno.readTextFile(path);
      return `=== ${path} ===\n${content}`;
    }),
  );
  return sections.join("\n\n");
}

const [diff, testFiles] = await Promise.all([getDiff(), readTestFiles()]);

if (!diff) {
  Deno.exit(0);
}

const client = new Anthropic();

const prDescription = Deno.env.get("PR_DESCRIPTION")?.trim() ?? "";
const prSection = prDescription
  ? `Here is the PR description for this deployment:\n\n${prDescription}\n\n`
  : "";

const response = await client.messages.create({
  model: "claude-opus-4-6",
  max_tokens: 256,
  output_config: {
    format: {
      type: "json_schema",
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
  messages: [
    {
      role: "user",
      content: `${prSection}Here is the git diff for this deployment:

${diff}

Here are the e2e test files and their full contents:

${testFiles}

Return the test files that should run given what changed.
If the PR description mentions specific tests or flows to verify, prioritise those.
Return an empty array if no e2e tests are needed.`,
    },
  ],
});

const block = response.content[0];
if (block.type !== "text") Deno.exit(0);

const { files } = JSON.parse(block.text) as { files: string[] };

if (files.length > 0) {
  console.log(files.join(" "));
}
