import { type Signal, useSignal, useSignalEffect } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback, useRef } from "preact/hooks";

import { candidate } from "#/client/generator-signals.ts";
import { useDebouncedCallback } from "#/client/use-debounced-callback.ts";
import { Select } from "#/components/select.tsx";
import { StarRating } from "#/components/star-rating.tsx";
import {
  type Feedback,
  REASON_TAGS,
  type ReasonTag,
} from "#/game/generated.ts";
import { DIFFICULTIES, type Difficulty, type Puzzle } from "#/game/types.ts";

type CandidateFeedbackProps = {
  /** The board being rated — its difficulty is the curator's to overrule. */
  puzzle: Signal<Puzzle>;
  className?: string;
};

const DIFFICULTY_OPTIONS = DIFFICULTIES.map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));

/** How long typing pauses before the note is saved. */
const NOTE_DEBOUNCE_MS = 800;

/**
 * Board-adjacent curation feedback for a freshly generated candidate. Shows a
 * star rating, the curator's difficulty call and an always-available note; once
 * rated, reveals reason tags. Every change is patched onto the candidate's file
 * in the `generated/` store (dev-only).
 *
 * State is per-candidate: it resets whenever the shared `candidate` signal
 * points at a new slug (a reroll), so feedback never bleeds between boards.
 *
 * Difficulty opens on what the move count suggests; overriding it is the point,
 * since a curator disagreeing with the move count is the signal worth
 * collecting. Setting it also updates the board's badge, so the label the
 * curator sees is the one that gets stored — and the one that follows the board
 * into the editor if it's promoted.
 */
export function CandidateFeedback(
  { puzzle, className }: CandidateFeedbackProps,
) {
  const rating = useSignal<number | undefined>(undefined);
  const reasons = useSignal<ReasonTag[]>([]);
  const note = useSignal("");
  // Set when a patch doesn't reach disk. A silent failure once cost a whole
  // session's notes, so a failed save says so rather than being swallowed.
  const error = useSignal<string | null>(null);

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
    error.value = null;
  });

  const patch = useCallback(async (feedback: Feedback) => {
    const slug = candidate.value?.slug;
    if (!slug) return;
    try {
      const res = await fetch("/api/generated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "feedback", slug, ...feedback }),
      });
      error.value = res.ok ? null : `Not saved — ${await res.text()}`;
    } catch (err) {
      error.value = `Not saved — ${
        err instanceof Error ? err.message : "request failed"
      }`;
    }
  }, []);

  const current = (): Feedback => ({
    rating: rating.value,
    reasons: reasons.value,
    note: note.value || undefined,
    difficulty: puzzle.value.difficulty,
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

  const onDifficulty = useCallback((value: Difficulty) => {
    puzzle.value = { ...puzzle.value, difficulty: value };
    patch(current());
  }, [patch]);

  // Saved while typing, not only on blur — a note the curator never clicked
  // away from used to be lost entirely.
  const saveNote = useDebouncedCallback(
    () => patch(current()),
    NOTE_DEBOUNCE_MS,
  );

  const onNoteBlur = useCallback(() => {
    saveNote.clear();
    patch(current());
  }, [patch]);

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

      <Select
        label="Difficulty"
        name="candidate-difficulty"
        value={puzzle.value.difficulty}
        options={DIFFICULTY_OPTIONS}
        onChange={(value) => onDifficulty(value as Difficulty)}
      />

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
