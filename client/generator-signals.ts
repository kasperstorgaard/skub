import { signal } from "@preact/signals";

import type { StoredCandidate } from "#/game/generated.ts";

/**
 * Cross-island generator state, shared as a module singleton rather than a
 * route-level prop signal. Both the sidebar `GeneratorPanel` (which writes it)
 * and the board-adjacent `CandidateFeedback` (which reads it) import the same
 * module instance, so they share state without threading a signal through the
 * page's serialized props — which would otherwise entangle it with Fresh's
 * per-island hydration of the `puzzle` signal.
 *
 * Holds the current stored candidate — its slug/name plus any feedback already
 * on file (a restored candidate carries its stored rating; a fresh one none) —
 * or null when there's none yet (an empty store, or a run in flight).
 *
 * "Feedback" spans both levels of judgement: the puzzle's rating, tags,
 * difficulty and note, which `CandidateFeedback` owns, and `solutionTags` —
 * per-route labels the panel writes while the curator works through the
 * solutions. They're patched through separate endpoints so neither island's
 * full-state write can clobber the other's.
 */
export const candidate = signal<StoredCandidate | null>(null);
