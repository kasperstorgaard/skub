/**
 * Rebuilds the highscore index from the user scores, for when how a score
 * ranks changes (e.g. points per kind): an award only moves the key it would
 * write today, so keys from an older rank stay behind. Run against production
 * with:
 * deno run --tunnel -A ./scripts/reindex-highscore.ts
 *
 * Safe to run again. A star awarded mid-run can leave its player's old key,
 * so run it while it's quiet, or twice.
 */
import { kv } from "#/db/kv.ts";
import { getHighscoreKey } from "#/db/score.ts";
import { emptyUserScore, type UserScore } from "#/game/score.ts";

let removed = 0;
for await (const { key } of kv.list({ prefix: ["highscore"] })) {
  await kv.delete(key);
  removed++;
}

let indexed = 0;
for await (
  const { key, value } of kv.list<UserScore>({ prefix: ["user_score"] })
) {
  const userScore = { ...emptyUserScore, ...value };
  await kv.set(getHighscoreKey(key[1] as string, userScore), userScore);
  indexed++;
}

console.log(`Removed ${removed} highscore keys, indexed ${indexed} players`);
