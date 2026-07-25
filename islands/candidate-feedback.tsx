import { useSignal, useSignalEffect } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useRef } from "preact/hooks";

import { candidate } from "#/client/generator-signals.ts";
import { StarRating } from "#/components/star-rating.tsx";
import {
  type Feedback,
  REASON_TAGS,
  type ReasonTag,
} from "#/game/generated.ts";

type CandidateFeedbackProps = {
  className?: string;
};

/**
 * Board-adjacent curation feedback for a freshly generated candidate. Shows a
 * star rating and an always-available note; once rated, reveals reason tags.
 * Every change is patched onto the candidate's file in the `generated/` store
 * (dev-only; a 403 in production is swallowed).
 *
 * State is per-candidate: it resets whenever the shared `candidate` signal
 * points at a new slug (a reroll), so feedback never bleeds between boards.
 */
export function CandidateFeedback({ className }: CandidateFeedbackProps) {
  const rating = useSignal<number | undefined>(undefined);
  const reasons = useSignal<ReasonTag[]>([]);
  const note = useSignal("");

  // Re-seed the form when the candidate changes (identified by slug): a fresh
  // generation starts blank, a restored candidate shows its stored feedback.
  const lastSlug = useRef<string | null>(null);
  useSignalEffect(() => {
    const current = candidate.value;
    if ((current?.slug ?? null) === lastSlug.current) return;
    lastSlug.current = current?.slug ?? null;
    rating.value = current?.rating;
    reasons.value = current?.reasons ?? [];
    note.value = current?.note ?? "";
  });

  const patch = useCallback((feedback: Feedback) => {
    const slug = candidate.value?.slug;
    if (!slug) return;
    // Fire-and-forget; dev-only endpoint, failures are non-fatal to curation.
    fetch("/api/generated", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "feedback", slug, ...feedback }),
    }).catch(() => {});
  }, [candidate]);

  const current = (): Feedback => ({
    rating: rating.value,
    reasons: reasons.value,
    note: note.value || undefined,
  });

  const onRate = useCallback((value: number | undefined) => {
    rating.value = value;
    // Clearing the rating drops the qualitative detail too.
    if (value === undefined) {
      reasons.value = [];
      note.value = "";
      patch({ rating: undefined, reasons: [], note: undefined });
      return;
    }
    patch({ ...current(), rating: value });
  }, [patch]);

  const toggleReason = useCallback((tag: ReasonTag) => {
    reasons.value = reasons.value.includes(tag)
      ? reasons.value.filter((r) => r !== tag)
      : [...reasons.value, tag];
    patch(current());
  }, [patch]);

  const onNoteBlur = useCallback(() => patch(current()), [patch]);

  if (!candidate.value) return null;

  const rated = rating.value !== undefined;

  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-fl-2 text-center",
        className,
      )}
    >
      <p className="text-4 text-brand leading-flat">{candidate.value.name}</p>

      <StarRating
        label="Rate this candidate"
        value={rating.value}
        onChange={onRate}
      />

      {rated && (
        <div className="flex flex-wrap justify-center gap-1">
          {REASON_TAGS.map((tag) => {
            const active = reasons.value.includes(tag.value);
            return (
              <button
                key={tag.value}
                type="button"
                aria-pressed={active}
                className={clsx(
                  "text-fl-0 rounded-1 px-fl-1 py-1 cursor-pointer",
                  active
                    ? "bg-brand text-surface-1 font-weight-7"
                    : "bg-surface-1 text-text-2 hover:bg-surface-3",
                )}
                onClick={() => toggleReason(tag.value)}
              >
                {tag.label}
              </button>
            );
          })}
        </div>
      )}

      <textarea
        className="text-1 bg-surface-1 rounded-1 p-fl-1 resize-y min-h-[3lh] w-full max-w-2xs text-start"
        placeholder="Note (optional)"
        value={note.value}
        onInput={(e) => (note.value = e.currentTarget.value)}
        onBlur={onNoteBlur}
      />
    </div>
  );
}
