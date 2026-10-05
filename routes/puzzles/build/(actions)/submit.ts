import { define } from "#/core.ts";
import { parsePuzzle } from "#/game/parser.ts";
import type { Puzzle } from "#/game/types.ts";
import { sendEmail } from "#/lib/email.ts";
import { trackPuzzleSubmitted } from "#/lib/tracking.ts";

const SUBMISSIONS_TO = "kasper.storgaard@gmail.com";
const SUBMISSIONS_FROM = "Skub <submissions@skub.app>";

/**
 * Emails the editor's board to Kasper. Lenient on purpose: the board is only
 * parsed, not solved — the editor keeps the button disabled until it solves.
 * No rate limiting either; revisit if submissions get abused.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const markdown = form.get("markdown")?.toString() ?? "";

    let puzzle: Puzzle;
    try {
      puzzle = parsePuzzle(markdown, { validate: false });
    } catch {
      return redirect("failed");
    }

    // A logged-in player chooses whether to be named; a guest by typing an email.
    const user = ctx.state.user;
    const identified = !user.email || form.has("include_email");
    const replyTo = user.email
      ? (identified ? user.email : undefined)
      : toEmail(form.get("email"));
    const note = form.get("note")?.toString().trim().slice(0, 2000) ?? "";
    const name = puzzle.name || "Untitled";

    try {
      await sendEmail({
        from: SUBMISSIONS_FROM,
        to: SUBMISSIONS_TO,
        subject: `Puzzle submission: ${name}`,
        replyTo,
        text: [
          `Name: ${name}`,
          `Moves: ${puzzle.minMoves || "unknown"}`,
          `From: ${(identified && user.name) || "anonymous"}${
            replyTo ? ` <${replyTo}>` : ""
          }`,
          "",
          ...(note ? ["Note:", note, ""] : []),
          markdown,
        ].join("\n"),
        attachments: [{ filename: "submission.md", content: markdown }],
      });
    } catch (err) {
      console.error("Puzzle submission email failed", err);
      return redirect("failed");
    }

    trackPuzzleSubmitted(ctx.state, puzzle, {
      url: ctx.req.url,
      hasReplyTo: !!replyTo,
      hasNote: !!note,
    });

    return redirect("sent");
  },
});

function redirect(result: "sent" | "failed") {
  return new Response(null, {
    headers: { Location: `/puzzles/build?submit=${result}` },
    status: 303,
  });
}

/** An optional address typed into the form; anything unlike one is dropped. */
function toEmail(value: FormDataEntryValue | null) {
  const email = value?.toString().trim() ?? "";
  return /^[^\s@]+@[^\s@]+$/.test(email) && email.length <= 254
    ? email
    : undefined;
}
