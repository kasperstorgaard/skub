import { type Signal, useComputed } from "@preact/signals";
import { useCallback } from "preact/hooks";

import { Select } from "#/components/select.tsx";
import {
  type ComposerConfig,
  TILE_OPTIONS_COOKIE,
  TILE_OPTIONS_MAX_AGE,
  validatePattern,
} from "#/game/tiles.ts";
import { TILE_CATEGORIES, type TileCategory } from "#/game/types.ts";

type TileConfigProps = { config: Signal<ComposerConfig> };

const DEFAULT_PATTERN: TileCategory[] = ["A", "A", "B", "B"];

const QUADRANT_LABELS = ["NW", "NE", "SW", "SE"];

/**
 * The composer's settings: what to deal, and what a roll may come back with.
 *
 * Configuration only — the acting is done beside the board. Settings persist in
 * a cookie so a session picks up where the last one left off; dealing happens
 * client-side, so this writes the cookie itself.
 */
/**
 * A move bound off an input. An emptied field reads as 0, which is an ordinary
 * step in retyping a number rather than a bound anyone means — and a range
 * starting at 0 accepts a board the solver failed on, since a failure counts as
 * no moves.
 */
function boundOf(value: string): number {
  return Math.max(1, Number(value) || 1);
}

export function TileConfig({ config }: TileConfigProps) {
  const update = useCallback((patch: Partial<ComposerConfig>) => {
    const next = { ...config.value, ...patch };
    config.value = next;

    document.cookie = `${TILE_OPTIONS_COOKIE}=${
      encodeURIComponent(JSON.stringify(next))
    }; path=/puzzles; max-age=${TILE_OPTIONS_MAX_AGE}; samesite=lax`;
  }, [config]);

  // A P or Z tile carries one half of a pair, so a pattern needs none or two.
  const patternError = useComputed(() => {
    if (config.value.mode !== "pattern") return null;

    try {
      validatePattern(config.value.pattern ?? DEFAULT_PATTERN);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  });

  const pattern = config.value.pattern ?? DEFAULT_PATTERN;
  const moves = config.value.moves;

  return (
    <div className="flex flex-col gap-fl-2">
      <Select
        label="Selection"
        name="mode"
        value={config.value.mode}
        options={[
          { value: "random", label: "Random" },
          { value: "pattern", label: "Pattern" },
        ]}
        onChange={(value) => update({ mode: value as ComposerConfig["mode"] })}
      />

      {config.value.mode === "pattern"
        ? (
          <div className="flex flex-col gap-1 text-fl-0">
            <div className="flex gap-1">
              {QUADRANT_LABELS.map((quadrant, index) => (
                <Select
                  key={quadrant}
                  label={quadrant}
                  name={`pattern-${quadrant}`}
                  value={pattern[index]}
                  options={TILE_CATEGORIES.map((category) => ({
                    value: category,
                    label: category,
                  }))}
                  onChange={(value) =>
                    update({
                      pattern: pattern.map((code, at) =>
                        at === index ? value as TileCategory : code
                      ),
                    })}
                />
              ))}
            </div>

            {patternError.value && (
              <p className="text-brand">{patternError.value}</p>
            )}
          </div>
        )
        : (
          <fieldset className="flex flex-col gap-1 text-fl-0">
            <legend>Include</legend>

            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={Boolean(config.value.portals)}
                onChange={(event) =>
                  update({ portals: event.currentTarget.checked })}
              />
              Portals
            </label>

            <label className="flex gap-2 items-center">
              <input
                type="checkbox"
                checked={Boolean(config.value.holes)}
                onChange={(event) =>
                  update({ holes: event.currentTarget.checked })}
              />
              Holes
            </label>
          </fieldset>
        )}

      <label className="flex flex-col gap-1 text-fl-0">
        Distinct tiles: {config.value.distinct ?? 4}
        <input
          type="range"
          min={1}
          max={4}
          step={1}
          value={config.value.distinct ?? 4}
          onInput={(event) =>
            update({ distinct: Number(event.currentTarget.value) })}
        />
        <span className="text-text-3">
          Fewer means the same tile turns up more than once, turned a different
          way — which is what makes a board look symmetric.
        </span>
      </label>

      <fieldset className="flex flex-col gap-1 text-fl-0">
        <legend>Moves</legend>

        <label className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={Boolean(moves)}
            onChange={(event) =>
              update({
                moves: event.currentTarget.checked ? [7, 9] : undefined,
              })}
          />
          Keep rolling until in range
        </label>

        {moves && (
          <div className="flex gap-1 items-center">
            <input
              type="number"
              className="w-14 py-1 px-fl-1 rounded-1 bg-surface-1 text-text-1"
              aria-label="Fewest moves"
              min={1}
              max={15}
              value={moves[0]}
              onInput={(event) =>
                update({
                  moves: [boundOf(event.currentTarget.value), moves[1]],
                })}
            />
            <span aria-hidden="true">–</span>
            <input
              type="number"
              className="w-14 py-1 px-fl-1 rounded-1 bg-surface-1 text-text-1"
              aria-label="Most moves"
              min={1}
              max={15}
              value={moves[1]}
              onInput={(event) =>
                update({
                  moves: [moves[0], boundOf(event.currentTarget.value)],
                })}
            />
          </div>
        )}
      </fieldset>
    </div>
  );
}
