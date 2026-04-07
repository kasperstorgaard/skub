import { define } from "#/core.ts";
import { kv } from "#/db/kv.ts";
import type { Solution, User } from "#/db/types.ts";
import { assessSkillLevel } from "#/game/skill.ts";
import type { PuzzleManifestEntry, SkillLevel } from "#/game/types.ts";

/**
 * GET /api/migrate-skill-level?secret=<MIGRATE_SECRET>
 *
 * Assesses each user's skill level from their solution history and sets skillLevel:
 *   expert       — any medium/hard puzzle solved with moves === minMoves
 *   intermediate — any medium puzzle solved with moves <= minMoves * 1.33
 *   beginner     — has any solutions, or old onboarding field was non-"new"
 *   null         — no solutions and no prior onboarding progress
 *
 * Idempotent: skips users who already have skillLevel.
 */
export const handler = define.handlers({
  async GET(ctx) {
    const secret = ctx.url.searchParams.get("secret");
    const migrateSecret = Deno.env.get("MIGRATE_SECRET");

    if (!migrateSecret || secret !== migrateSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const manifestRaw = await Deno.readTextFile(
      `${Deno.cwd()}/static/puzzles/manifest.json`,
    );
    const manifest = JSON.parse(manifestRaw) as PuzzleManifestEntry[];
    const puzzleLookup = new Map(manifest.map((entry) => [entry.slug, entry]));

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const log = (msg: string) =>
          controller.enqueue(encoder.encode(msg + "\n"));

        log("Starting migration: assess skill level from solution history");

        const userIds = new Set<string>();
        for await (const { key } of kv.list({ prefix: ["user"] })) {
          if (key.length === 2) userIds.add(key[1] as string);
        }

        log(`Found ${userIds.size} users`);

        let skipped = 0;
        let migrated = 0;

        for (const userId of userIds) {
          const existing = await kv.get<User>(["user", userId]);
          const user = existing.value;
          if (!user) continue;

          if ("skillLevel" in user) {
            skipped++;
            log(
              `${userId}: already has skillLevel (${user.skillLevel}), skipping`,
            );
            continue;
          }

          // Read all solutions for this user
          const solutions: Solution[] = [];
          for await (
            const { value } of kv.list<Solution>({
              prefix: ["solutions_by_user", userId],
            })
          ) {
            if (value) solutions.push(value);
          }

          const oldUser = user as Omit<User, "skillLevel"> & {
            onboarding: string;
          };

          let skillLevel: SkillLevel | null = null;

          for (const solution of solutions) {
            const puzzle = puzzleLookup.get(solution.puzzleSlug);
            if (!puzzle) continue;
            skillLevel = assessSkillLevel(puzzle, solution.moves);
            if (skillLevel === "expert") break;
          }

          await kv.set(["user", userId], { ...oldUser, skillLevel });

          migrated++;
          log(
            `${userId}: skillLevel=${skillLevel} (${solutions.length} solutions, onboarding=${
              oldUser.onboarding ?? "none"
            })`,
          );
        }

        log(`\nDone.`);
        log(`  Migrated: ${migrated}`);
        log(`  Skipped (already set): ${skipped}`);

        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  },
});
