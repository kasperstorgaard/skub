/**
 * One-off: renames candidate families whose base slug is held by a different
 * shipped puzzle to `candidate-{n}`, so every corpus slug is free for its own
 * corpus copy. Variants move with their base; `promotedAs` is left as is.
 * Numbered in base `createdAt` order. Uses `git mv` so history follows.
 *
 *   deno run -A scripts/migrate-candidate-names.ts          # dry run
 *   deno run -A scripts/migrate-candidate-names.ts --write
 */
import { readCandidates } from "#/game/candidate-store.ts";
import {
  candidateFamilies,
  CANDIDATES_DIR,
  candidateSource,
  formatCandidate,
  nextCandidateNumber,
  parseCandidate,
} from "#/game/candidates.ts";
import { getCorpusSlugs } from "#/game/loader.ts";

const write = Deno.args.includes("--write");

const candidates = await readCandidates();
const corpusSlugs = await getCorpusSlugs();

const clashing = candidateFamilies(candidates)
  .filter((family) => {
    const base = family.members.find((c) => c.slug === family.base);
    return base && corpusSlugs.has(base.slug) &&
      candidateSource(base) !== "corpus" && base.promotedAs !== base.slug;
  })
  .map((family) => family.members)
  .toSorted((a, b) =>
    new Date(a[0].createdAt).getTime() - new Date(b[0].createdAt).getTime()
  );

let number = nextCandidateNumber(candidates.map((c) => c.slug));

for (const members of clashing) {
  const base = members[0].slug;
  const renamed = `candidate-${number++}`;

  for (const candidate of members) {
    const slug = candidate.slug.replace(base, renamed);
    console.log(`${candidate.slug} → ${slug}`);
    if (!write) continue;

    const from = `${CANDIDATES_DIR}/${candidate.slug}.md`;
    const to = `${CANDIDATES_DIR}/${slug}.md`;
    const mv = await new Deno.Command("git", { args: ["mv", from, to] })
      .output();
    if (!mv.success) throw new Error(new TextDecoder().decode(mv.stderr));

    const stored = parseCandidate(await Deno.readTextFile(to));
    await Deno.writeTextFile(
      to,
      formatCandidate({ ...stored, name: slug, slug }),
    );
  }
}

console.log(
  `\n${clashing.length} families, ${clashing.flat().length} files${
    write ? "" : " (dry run)"
  }`,
);
