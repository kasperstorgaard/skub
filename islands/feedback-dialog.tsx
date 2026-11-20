import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useEffect, useMemo, useState } from "preact/hooks";

import { feedbackSent } from "#/client/feedback-signals.ts";
import { DialogActions, DISMISS } from "#/components/dialog-actions.tsx";
import {
  ArrowRight,
  Icon,
  PaperPlaneTilt,
  Spinner,
  ThumbsDown,
  ThumbsUp,
} from "#/components/icons.tsx";
import type { FeedbackSource } from "#/game/feedback.ts";
import type { Puzzle } from "#/game/types.ts";
import { Dialog } from "#/islands/dialog.tsx";
import { useRouter } from "#/islands/router.tsx";

type Props = {
  href: Signal<string>;
  /** The puzzle the feedback is about: adds the rating. Unset: the game. */
  puzzle?: Pick<Puzzle, "slug" | "name">;
  // The logged-in player's address, used as Reply-To.
  userEmail?: string;
};

// Full width, equal segments, so the two rating rows line up as one block
const SEGMENTS = clsx(
  "grid grid-flow-col auto-cols-fr gap-1 p-1 m-0 min-w-0",
  "rounded-round bg-surface-2 border-0",
);
// A segment lights up in its own colour once picked
const SEGMENT = clsx(
  "flex items-center justify-center gap-2 py-2 px-2 rounded-round",
  "text-2 whitespace-nowrap cursor-pointer",
  "text-text-2 hover:text-text-1 has-checked:text-text-1",
  "has-focus-visible:outline-2 has-focus-visible:outline-brand",
);

// Good reads teal, bad red; difficulty runs teal, violet, orange. Full class
// names, so Tailwind finds them.
const TONES = {
  good: "has-checked:bg-teal-4/30 [&_svg]:text-teal-4",
  bad: "has-checked:bg-red-6/30 [&_svg]:text-red-6",
  easy: "has-checked:bg-teal-4/30",
  right: "has-checked:bg-violet-5/35",
  hard: "has-checked:bg-orange-6/30",
};

/**
 * Rates a puzzle and/or sends a line of feedback, driven by `?dialog=`:
 * `feedback` (with `from=` the source) asks, `feedback-sent`/`feedback-failed`
 * is the answer. Posts to `/feedback`; with JS it fetches and stays on the page.
 *
 * Also opens from any `a[data-feedback]` (the sidebar's link) on the current
 * URL, so a board in play keeps its moves.
 */
export function FeedbackDialog({ href, puzzle, userEmail }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Nothing to send until a rating is picked or a line written. Only once
  // hydrated: without JS the server answers an empty send instead.
  const [isEmpty, setIsEmpty] = useState(false);
  // A reply address only matters with a message to reply to. Without JS it's
  // always shown, and the server drops it when there's no message.
  const [hasMessage, setHasMessage] = useState(true);

  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  const { updateLocation } = useRouter({ onLocationUpdated });

  const params = useMemo(() => new URL(href.value).searchParams, [
    href.value,
  ]);
  const step = params.get("dialog");
  const source = (params.get("from") ?? "panel") as FeedbackSource;

  useEffect(() => {
    setIsEmpty(true);
    setHasMessage(false);
  }, [step]);

  /** The page as it was before the dialog opened. */
  const closeHref = useMemo(() => {
    const url = new URL(href.value);
    url.searchParams.delete("dialog");
    url.searchParams.delete("from");
    return url.href;
  }, [href.value]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");
      if (!anchor?.hasAttribute("data-feedback")) return;

      event.preventDefault();
      const url = new URL(self.location.href);
      url.searchParams.set("dialog", "feedback");
      url.searchParams.set("from", "panel");
      updateLocation(url.href);
    };

    self.addEventListener("click", onClick);
    return () => self.removeEventListener("click", onClick);
  }, []);

  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const result = await fetch("/feedback", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: new FormData(event.currentTarget as HTMLFormElement),
    }).then((res) => res.ok ? "sent" : "failed", () => "failed");

    setIsSubmitting(false);
    if (result === "sent") feedbackSent.value = true;
    const url = new URL(closeHref);
    url.searchParams.set("dialog", `feedback-${result}`);
    updateLocation(url.href, { replace: true });
  };

  if (step === "feedback-sent" || step === "feedback-failed") {
    const isSent = step === "feedback-sent";

    return (
      <Dialog open>
        <div className="flex flex-col gap-fl-2 text-text-2">
          <h2 className="text-fl-2 font-semibold text-text-1">
            {isSent ? "Thanks!" : "Not sent"}
          </h2>

          <p>
            {isSent
              ? "Much appreciated, it really helps."
              : "That didn't go through. Try again."}
          </p>
        </div>

        <DialogActions
          dismiss={
            <a href={closeHref} data-router="replace" className={DISMISS}>
              Close
            </a>
          }
        >
          {isSent && (
            <a href="/puzzles/recommended" className="btn" autoFocus>
              Play one more <Icon icon={ArrowRight} />
            </a>
          )}
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={step === "feedback"}>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-fl-2 font-semibold text-text-1">
          {puzzle ? `How was ${puzzle.name}?` : "Send feedback"}
        </h2>

        <p>
          {puzzle
            ? "Let me know what you think."
            : "Ideas, wishes, bugs: it all helps."}
        </p>
      </div>

      <form
        id="feedback"
        action="/feedback"
        method="post"
        className="flex flex-col gap-fl-2"
        onSubmit={onSubmit}
        onInput={(event) => {
          const form = new FormData(event.currentTarget);
          const message = !!form.get("message")?.toString().trim();
          setHasMessage(message);
          setIsEmpty(!form.get("difficulty") && !form.get("liked") && !message);
        }}
      >
        <input type="hidden" name="return" value={closeHref} />
        <input type="hidden" name="source" value={source} />
        {puzzle && <input type="hidden" name="slug" value={puzzle.slug} />}

        {puzzle && (
          <div className="grid gap-2">
            <fieldset className={SEGMENTS}>
              <legend className="sr-only">Difficulty</legend>
              {(
                [["easy", "Too easy"], ["right", "Just right"], [
                  "hard",
                  "Too hard",
                ]] as const
              ).map(([value, label]) => (
                <label key={value} className={clsx(SEGMENT, TONES[value])}>
                  <input
                    type="radio"
                    name="difficulty"
                    value={value}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </fieldset>

            <fieldset className={SEGMENTS}>
              <legend className="sr-only">Did you like it?</legend>
              <label className={clsx(SEGMENT, TONES.good)}>
                <input
                  type="radio"
                  name="liked"
                  value="yes"
                  className="sr-only"
                />
                <Icon icon={ThumbsUp} /> Liked it
              </label>
              <label className={clsx(SEGMENT, TONES.bad)}>
                <input
                  type="radio"
                  name="liked"
                  value="no"
                  className="sr-only"
                />
                <Icon icon={ThumbsDown} /> Not for me
              </label>
            </fieldset>
          </div>
        )}

        <label className="flex flex-col">
          <span className="sr-only">
            {puzzle ? "Anything else (optional)" : "Message"}
          </span>
          <textarea
            name="message"
            placeholder={puzzle ? "Anything else? (optional)" : "Message"}
            rows={2}
            maxLength={2000}
            required={!puzzle}
            className="border border-surface-4 p-2 bg-surface-2 text-2 rounded-1"
          />
        </label>

        {hasMessage && (userEmail
          ? (
            <label className="flex items-center gap-2 text-text-2 text-1">
              <input type="checkbox" name="include_email" defaultChecked />
              Include my email ({userEmail})
            </label>
          )
          : (
            <label className="flex flex-col">
              <span className="sr-only">Email (optional, so I can reply)</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="Email (optional, so I can reply)"
                className="border border-surface-4 p-2 bg-surface-2 text-2 rounded-1"
              />
            </label>
          ))}
      </form>

      <DialogActions
        dismiss={
          <a href={closeHref} data-router="replace" className={DISMISS}>
            Not now
          </a>
        }
      >
        <button
          form="feedback"
          type="submit"
          className="btn"
          disabled={isSubmitting || isEmpty}
        >
          <Icon
            icon={isSubmitting ? Spinner : PaperPlaneTilt}
            className={clsx(isSubmitting && "animate-spin")}
          />{" "}
          Send
        </button>
      </DialogActions>
    </Dialog>
  );
}
