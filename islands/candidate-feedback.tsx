import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback } from "preact/hooks";

import { useDebouncedCallback } from "#/client/use-debounced-callback.ts";
import { StarRating } from "#/components/star-rating.tsx";
import {
  type Feedback,
  REASON_TAGS,
  type ReasonTag,
  type StoredCandidate,
} from "#/game/candidates.ts";

type CandidateFeedbackProps = {
  /** The stored entry the feedback is written to, with what's on file. */
  candidate: StoredCandidate;
  className?: string;
};

/** How long typing pauses before the note is saved. */
const NOTE_DEBOUNCE_MS = 800;

/**
 * Board-level curation feedback for a candidate: a star rating, an
 * always-available note, and reason tags once rated. Every change is patched
 * onto the candidate's file in the `candidates/` store (dev-only). Seeded from
 * the server-rendered candidate, so a navigation resets the form.
 */
export function CandidateFeedback(
  { candidate, className }: CandidateFeedbackProps,
) {
  const rating = useSignal<number | undefined>(candidate.rating);
  const reasons = useSignal<ReasonTag[]>(candidate.reasons ?? []);
  const note = useSignal(candidate.note ?? "");
  // Set when a patch doesn't reach disk, so a failed save is visible.
  const error = useSignal<string | null>(null);

  const patch = useCallback(async (feedback: Feedback) => {
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "feedback",
          slug: candidate.slug,
          ...feedback,
        }),
      });
      error.value = res.ok ? null : `Not saved — ${await res.text()}`;
    } catch (err) {
      error.value = `Not saved — ${
        err instanceof Error ? err.message : "request failed"
      }`;
    }
  }, [candidate.slug]);

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

  // Saved while typing, not only on blur.
  const saveNote = useDebouncedCallback(
    () => patch(current()),
    NOTE_DEBOUNCE_MS,
  );

  const onNoteBlur = useCallback(() => {
    saveNote.clear();
    patch(current());
  }, [patch]);

  const rated = rating.value !== undefined;

  return (
    <div
      className={clsx(
        "flex flex-col items-center gap-fl-2 text-center",
        className,
      )}
    >
      <p className="text-4 text-brand leading-flat">{candidate.name}</p>

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
        onInput={(e) => {
          note.value = e.currentTarget.value;
          saveNote();
        }}
        onBlur={onNoteBlur}
      />

      {error.value && (
        <p role="status" className="text-fl-0 text-text-1 leading-tight">
          {error.value}
        </p>
      )}
    </div>
  );
}
