import { clsx } from "clsx/lite";

import {
  CaretRight,
  Icon,
  Pencil,
  Play,
  PlusSquare,
  RocketLaunch,
} from "#/components/icons.tsx";
import { Panel } from "#/components/panel.tsx";
import type { StoredScoring } from "#/game/candidates.ts";
import { boardCharacter, type CharacterTrait } from "#/game/character.ts";
import { meanMetrics, METRIC_CATALOG } from "#/game/metric-catalog.ts";
import type { Metrics } from "#/game/scoring.ts";
import type { Puzzle } from "#/game/types.ts";
import { SolutionTags } from "#/islands/solution-tags.tsx";

/** One label/value row in the candidate's score readout. */
function ScoreStat(
  { label, value, hint, percent, whole }: {
    label: string;
    value: number;
    hint?: string;
    percent?: boolean;
    whole?: boolean;
  },
) {
  const display = percent
    ? `${Math.round(value * 100)}%`
    : whole
    ? String(value)
    : value.toFixed(2);

  return (
    <div
      className="flex justify-between gap-fl-1 py-1"
      title={hint ? `${label} — ${hint}` : undefined}
    >
      <dt className={clsx("text-text-2", hint && "cursor-help")}>{label}</dt>
      <dd className="text-text-1 font-weight-7 tabular-nums">{display}</dd>
    </div>
  );
}

/** Headline metric, shown above the fold rather than in the details list. */
const HEADLINE_METRIC = "uniqueSolutions";

/** The metric rows for one scope, in catalog order. */
function MetricRows(
  { metrics, scope }: { metrics: Metrics; scope: "board" | "route" },
) {
  return (
    <>
      {METRIC_CATALOG
        .filter((spec) =>
          spec.scope === scope &&
          !(scope === "board" && spec.key === HEADLINE_METRIC)
        )
        .map((spec) => (
          <ScoreStat
            key={spec.key}
            label={spec.label}
            value={metrics[spec.key]}
            hint={spec.hint}
            percent={"percent" in spec ? spec.percent : undefined}
            whole={"whole" in spec ? spec.whole : undefined}
          />
        ))}
    </>
  );
}

/**
 * The advisory score for a candidate: a headline (composite, weakest route,
 * solution count) over a collapsible breakdown of every metric, split by scope.
 * Board metrics are stated once; route metrics show the selected solution's
 * values, or the mean across routes when none is selected. Rows come from
 * `METRIC_CATALOG` so the panel can't drift from what the reports measure.
 */
function CandidateScore(
  { scoring, selected }: { scoring: StoredScoring; selected: number | null },
) {
  const route = selected === null ? null : scoring.solutions[selected];
  const routeMetrics = route?.metrics ??
    meanMetrics(scoring.solutions.map((solution) => solution.metrics));
  const routeHeading = selected !== null && route
    ? `Solution ${selected + 1} · ${route.score.toFixed(2)}`
    : "Solutions · mean";

  return (
    <div className="flex flex-col gap-fl-1 text-1">
      <dl className="flex flex-col">
        <ScoreStat
          label="Score"
          value={scoring.score}
          hint="Advisory composite quality score — the mean across routes."
        />
        <ScoreStat
          label="Weakest route"
          value={scoring.min}
          hint="Score of the worst single solution route — an outlier detector."
        />
        <ScoreStat
          label="Solutions"
          value={scoring.metrics[HEADLINE_METRIC]}
          whole
          hint="Number of distinct optimal solutions."
        />
      </dl>

      {
        /* `group-open:mb-0` drops normalize's `details[open] > summary` margin,
          which would otherwise show a surface-2 seam between bar and content. */
      }
      <details className="group p-0 bg-none">
        <summary className="flex items-center gap-1 list-none bg-surface-3 cursor-pointer -mx-5 px-5 rounded-none group-open:mb-0">
          <Icon
            icon={CaretRight}
            className="transition-transform group-open:rotate-90"
          />
          Details
        </summary>

        <div className="flex flex-col bg-surface-3 -mx-5 px-5 pb-2">
          <p className="text-fl-0 text-text-3 uppercase tracking-wider mt-1">
            Board
          </p>
          <dl className="flex flex-col">
            <ScoreStat
              label="Mean"
              value={scoring.mean}
              hint="Mean route score across the distinct solutions."
            />
            <ScoreStat
              label="Std dev"
              value={scoring.stddev}
              hint="Spread of route scores across solutions."
            />
            <MetricRows metrics={scoring.metrics} scope="board" />
          </dl>

          <p className="text-fl-0 text-text-3 uppercase tracking-wider mt-fl-1">
            {routeHeading}
          </p>
          <dl className="flex flex-col">
            <MetricRows metrics={routeMetrics} scope="route" />
          </dl>
        </div>
      </details>
    </div>
  );
}

/** The board's character as tags — what kind of board, not how good. */
function BoardCharacter({ traits }: { traits: CharacterTrait[] }) {
  if (!traits.length) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {traits.map((trait) => (
        <span
          key={trait.label}
          title={trait.hint}
          className={clsx(
            "text-fl-0 rounded-1 px-fl-1 py-1 cursor-help leading-none",
            "bg-surface-1 text-text-2",
          )}
        >
          {trait.label}
        </span>
      ))}
    </div>
  );
}

/** How many routes to list — enough to compare, few enough to click through. */
const MAX_LISTED_SOLUTIONS = 8;

/**
 * The page URL for one solution: selected, and playing. The stored move
 * encoding is already the URL's, so a route travels to the board as-is.
 */
function watchHref(
  slug: string,
  scoring: StoredScoring,
  index: number,
): string {
  const params = new URLSearchParams({
    slug,
    moves: scoring.solutions[index].moves,
    mode: "replay",
    solution: String(index),
  });
  return `/candidate?${params}`;
}

/**
 * One link per distinct solution, weakest route first. Picking a route plays
 * it. Links, not buttons: the selection lives in the URL, so a route can be
 * reloaded or shared, and the page load is what restarts the animation.
 */
function SolutionList(
  { slug, scoring, selected }: {
    slug: string;
    scoring: StoredScoring;
    selected: number | null;
  },
) {
  // Weakest first. `toSorted` copies, leaving the stored order the URL indexes.
  const ranked = scoring.solutions
    .map((solution, index) => ({ ...solution, index }))
    .toSorted((a, b) => a.score - b.score);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-fl-0 text-text-2">
        Solutions{ranked.length > MAX_LISTED_SOLUTIONS &&
          ` (${MAX_LISTED_SOLUTIONS} of ${ranked.length})`}
      </span>

      <div className="flex flex-wrap gap-1">
        {ranked.slice(0, MAX_LISTED_SOLUTIONS).map((route) => (
          <a
            key={route.index}
            href={watchHref(slug, scoring, route.index)}
            aria-current={selected === route.index ? "true" : undefined}
            title={`Watch solution ${route.index + 1} — score ${
              route.score.toFixed(2)
            }`}
            className={clsx(
              "text-fl-0 rounded-1 px-fl-1 py-1 no-underline tabular-nums",
              selected === route.index
                ? "bg-brand text-surface-1 font-weight-7"
                : "bg-surface-1 text-text-2 hover:bg-surface-3",
            )}
          >
            {route.score.toFixed(2)}
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Everything about the selected solution: what kind of route it is, its tags,
 * and the link that plays it again. Tags apply to the selected route only —
 * the star rating is the puzzle-level verdict, these say which route earned it.
 */
function SolutionDetail(
  { slug, scoring, index, traits, tags }: {
    slug: string;
    scoring: StoredScoring;
    index: number;
    traits: CharacterTrait[];
    tags: string[];
  },
) {
  const route = scoring.solutions[index];

  return (
    <div className="flex flex-col gap-fl-1">
      <p className="flex justify-between gap-fl-1 text-1 leading-tight">
        <span className="text-text-2">Solution {index + 1}</span>
        <span className="text-text-1 font-weight-7 tabular-nums">
          {route.score.toFixed(2)}
        </span>
      </p>

      <BoardCharacter traits={traits} />

      <SolutionTags slug={slug} moves={route.moves} initialTags={tags} />

      <a href={watchHref(slug, scoring, index)} className="btn">
        <Icon icon={Play} />
        Watch again
      </a>
    </div>
  );
}

type CandidatePanelProps = {
  puzzle: Puzzle;
  scoring: StoredScoring;
  /** Index of the solution the URL has selected, if any. */
  selected: number | null;
  /** Stored per-route tags, keyed by the route's encoded moves. */
  solutionTags: Record<string, string[]>;
  /** The corpus slug this board shipped as, or null while it's still a candidate. */
  promotedAs: string | null;
};

/**
 * The candidate's analysis, whatever made the board: the composite readout,
 * every distinct solution scored and replayable, and — once a route is picked —
 * what it's like and what the curator says about it.
 *
 * Server-rendered from a finished analysis: the readout itself needs no client
 * code, and the route tags are the one part that does.
 */
export function CandidatePanel(
  { puzzle, scoring, selected, solutionTags, promotedAs }: CandidatePanelProps,
) {
  // What the character rules need beyond the metrics themselves.
  const context = {
    minMoves: puzzle.minMoves,
    walls: puzzle.board.walls.length,
    blockers: puzzle.board.pieces.filter((piece) => piece.type === "blocker")
      .length,
  };

  return (
    <Panel>
      <div className="flex flex-col col-[2/3] lg:row-[3/4] gap-fl-4 lg:gap-fl-1 place-content-between">
        <div className="flex flex-col gap-fl-1">
          <CandidateScore scoring={scoring} selected={selected} />

          <SolutionList
            slug={puzzle.slug}
            scoring={scoring}
            selected={selected}
          />

          {selected === null
            // With no route picked the character describes the board as a
            // whole, from the aggregate metrics.
            ? (
              <BoardCharacter
                traits={boardCharacter(scoring.metrics, context)}
              />
            )
            : (
              <SolutionDetail
                slug={puzzle.slug}
                scoring={scoring}
                index={selected}
                traits={boardCharacter(
                  scoring.solutions[selected].metrics,
                  context,
                )}
                tags={solutionTags[scoring.solutions[selected].moves] ?? []}
              />
            )}
        </div>

        {/* Back into the board, into the corpus, or on to the next one. */}
        <div className="flex flex-col flex-wrap gap-fl-1">
          <a href={`/candidate/edit?slug=${puzzle.slug}`} className="btn">
            <Icon icon={Pencil} /> Edit
          </a>

          {promotedAs
            ? (
              <a href={`/puzzles/${promotedAs}`} className="btn">
                <Icon icon={Play} /> Play
              </a>
            )
            : (
              <a
                href={`/candidate/promote?slug=${puzzle.slug}`}
                className="btn"
              >
                <Icon icon={RocketLaunch} /> Promote
              </a>
            )}

          <a href="/puzzles/new/reset" className="btn">
            <Icon icon={PlusSquare} /> New
          </a>
        </div>
      </div>
    </Panel>
  );
}
