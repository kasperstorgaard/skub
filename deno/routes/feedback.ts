import { define } from "#/core.ts";
import { saveFeedback } from "#/db/feedback.ts";
import {
  FEEDBACK_SOURCES,
  type FeedbackSource,
  parseRating,
} from "#/game/feedback.ts";
import { getPuzzle } from "#/game/loader.ts";
import { withRated } from "#/game/progress.ts";
import { canSendEmail, sendEmail, toEmail } from "#/lib/email.ts";
import { trackFeedbackSent } from "#/lib/tracking.ts";

const FEEDBACK_FROM = "Skub <feedback@skub.app>";

/**
 * Takes a rating, a message, or both, about a puzzle or the game. Kept in KV,
 * emailed to `SUBMISSIONS_EMAIL` the way puzzle submissions are, and tracked.
 * Sent counts as sent once either KV or the email takes it. A rating stored
 * marks the puzzle rated in the `progress` cookie, on both answers.
 *
 * Answers JSON to the dialog's fetch, otherwise 303s back to the page it came
 * from with `dialog=feedback-sent` / `feedback-failed`.
 */
export const handler = define.handlers({
  async POST(ctx) {
    const form = await ctx.req.formData();
    const returnUrl = toReturnUrl(form.get("return"), ctx.url);
    const respond = (result: "sent" | "failed") => {
      if (ctx.req.headers.get("accept")?.includes("application/json")) {
        return Response.json({ result }, {
          status: result === "sent" ? 200 : 400,
        });
      }
      returnUrl.searchParams.set("dialog", `feedback-${result}`);
      return new Response(null, {
        headers: { Location: returnUrl.href },
        status: 303,
      });
    };

    const slug = form.get("slug")?.toString();
    const puzzle = slug && /^[a-z0-9-]+$/.test(slug)
      ? await getPuzzle(slug)
      : null;
    const rating = puzzle ? parseRating(form) : undefined;
    const message = form.get("message")?.toString().trim().slice(0, 2000) ?? "";
    const sourceValue = form.get("source")?.toString() as FeedbackSource;
    const source = FEEDBACK_SOURCES.includes(sourceValue)
      ? sourceValue
      : "panel";

    if (!rating && !message) return respond("failed");

    // A logged-in player chooses whether to be named; a guest by typing an email.
    // Only with a message: a bare rating has nothing to reply to.
    const user = ctx.state.user;
    // Unchecking "include my email" (only offered with a message) also unnames.
    const identified = !user.email || !message || form.has("include_email");
    const replyTo = !message
      ? undefined
      : user.email
      ? (identified ? user.email : undefined)
      : toEmail(form.get("email"));

    const [stored, emailed] = await Promise.allSettled([
      saveFeedback({
        userId: ctx.state.userId,
        ...(puzzle && { puzzleSlug: puzzle.slug }),
        ...rating,
        ...(message ? { message } : {}),
        source,
      }),
      sendFeedbackEmail({
        puzzleName: puzzle?.name,
        rating: [
          rating?.difficulty && `difficulty ${rating.difficulty}`,
          rating?.liked !== undefined &&
          (rating.liked ? "liked" : "not for me"),
        ].filter(Boolean).join(", "),
        from: `${(identified && user.name) || "anonymous"}${
          replyTo ? ` <${replyTo}>` : ""
        }`,
        message,
        replyTo,
        url: returnUrl.href,
      }),
    ]);

    if (stored.status === "rejected") {
      console.error("Saving feedback failed", stored.reason);
    }
    if (emailed.status === "rejected") {
      console.error("Feedback email failed", emailed.reason);
    }
    if (stored.status === "rejected" && emailed.status === "rejected") {
      return respond("failed");
    }

    // Middleware re-signs the progress cookie with it.
    if (puzzle && rating && stored.status === "fulfilled") {
      ctx.state.rated = withRated(ctx.state.rated, puzzle.slug);
    }

    trackFeedbackSent(ctx.state, puzzle, {
      url: returnUrl.href,
      source,
      rating,
      message,
      hasReplyTo: !!replyTo,
    });

    return respond("sent");
  },
});

type FeedbackEmail = {
  puzzleName?: string;
  rating: string;
  from: string;
  message: string;
  replyTo?: string;
  url: string;
};

async function sendFeedbackEmail(email: FeedbackEmail) {
  // Not set up here (dev, previews): KV still has it.
  if (!canSendEmail) return;

  const to = Deno.env.get("SUBMISSIONS_EMAIL");
  if (!to) throw new Error("SUBMISSIONS_EMAIL is not set");

  const about = email.puzzleName ?? "the game";
  await sendEmail({
    from: FEEDBACK_FROM,
    to,
    subject: email.rating ? `Rating: ${about}` : `Feedback: ${about}`,
    replyTo: email.replyTo,
    text: [
      `About: ${about}`,
      ...(email.rating ? [`Rating: ${email.rating}`] : []),
      `From: ${email.from}`,
      `Page: ${email.url}`,
      ...(email.message ? ["", email.message] : []),
    ].join("\n"),
  });
}

/** Back to the page the feedback came from: same origin only, else home. */
function toReturnUrl(value: FormDataEntryValue | null, base: URL) {
  try {
    const url = new URL(value?.toString() ?? "/", base);
    if (url.origin === base.origin) return url;
  } catch {
    // Falls through to home.
  }
  return new URL("/", base);
}
