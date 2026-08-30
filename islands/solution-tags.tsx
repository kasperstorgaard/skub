import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useCallback } from "preact/hooks";

import {
  SOLUTION_TAG_VALUES,
  SOLUTION_TAGS,
  type SolutionTag,
} from "#/game/candidates.ts";

type SolutionTagsProps = {
  /** The stored candidate the route belongs to. */
  slug: string;
  /** The route being tagged, in the store's encoded-moves form. */
  moves: string;
  /** Tags already on file for this route. */
  initialTags: string[];
};

/**
 * Per-route labels for the selected solution. Uses the store's `solution`
 * action, not the `feedback` one — that patch is a full overwrite owned by
 * another island, and folding route tags in would race the star rating.
 */
export function SolutionTags({ slug, moves, initialTags }: SolutionTagsProps) {
  const tags = useSignal<SolutionTag[]>(
    initialTags.filter((tag): tag is SolutionTag =>
      (SOLUTION_TAG_VALUES as readonly string[]).includes(tag)
    ),
  );

  const onToggle = useCallback((tag: SolutionTag) => {
    const next = tags.value.includes(tag)
      ? tags.value.filter((value) => value !== tag)
      : [...tags.value, tag];
    tags.value = next;

    fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "solution", slug, moves, tags: next }),
    }).catch(() => {});
  }, [slug, moves]);

  return (
    <div className="flex flex-wrap gap-1">
      {SOLUTION_TAGS.map((tag) => {
        const active = tags.value.includes(tag.value);
        return (
          <button
            key={tag.value}
            type="button"
            aria-pressed={active}
            className={clsx(
              "text-fl-0 rounded-1 px-fl-1 py-1 cursor-pointer border-none",
              active
                ? "bg-brand text-surface-1 font-weight-7"
                : "bg-surface-1 text-text-2 hover:bg-surface-3",
            )}
            onClick={() => onToggle(tag.value)}
          >
            {tag.label}
          </button>
        );
      })}
    </div>
  );
}
