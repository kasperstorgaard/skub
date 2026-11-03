import { Pencil } from "#/components/icons.tsx";

/** Top-left corner of each cell in the 2x2 favicon board (100x100 viewBox). */
const CELLS = [[0, 0], [48, 0], [0, 48], [48, 48]] as const;

function shuffle(cells: number[]) {
  const out = [...cells];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Two arrangements of the four pieces where every piece changes cell. */
function getArrangements() {
  const from = shuffle([0, 1, 2, 3]);
  let to = shuffle([0, 1, 2, 3]);
  while (to.some((cell, i) => cell === from[i])) to = shuffle([0, 1, 2, 3]);
  return { from, to };
}

/**
 * Builder link icon: a faint favicon board whose pieces drift between two
 * random arrangements, with a pencil on top. Randomized per render, animated
 * in CSS only (`.builder-icon` in styles.css), still under reduced motion.
 */
export function BuilderIcon() {
  const { from, to } = getArrangements();

  // Each piece is drawn in the top-left cell and translated into place.
  const place = (piece: number) => {
    const [ax, ay] = CELLS[from[piece]];
    const [bx, by] = CELLS[to[piece]];
    return {
      "--ax": `${ax}px`,
      "--ay": `${ay}px`,
      "--bx": `${bx}px`,
      "--by": `${by}px`,
    } as preact.CSSProperties;
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 100 100"
      className="builder-icon inline align-middle max-w-none"
      aria-hidden="true"
    >
      <g className="builder-icon-board">
        <circle
          style={place(0)}
          cx="26"
          cy="26"
          r="16"
          fill="var(--color-ui-2)"
        />
        <rect
          style={place(1)}
          x="10"
          y="10"
          width="32"
          height="32"
          rx="5"
          fill="var(--color-ui-3)"
        />
        <line
          style={place(2)}
          x1="10"
          y1="46"
          x2="42"
          y2="46"
          stroke="var(--color-ui-4)"
          stroke-width="4"
        />
        <g
          style={place(3)}
          stroke="var(--color-ui-1)"
          stroke-width="3"
          fill="none"
        >
          <rect x="8" y="8" width="36" height="36" />
          <line x1="8" y1="8" x2="44" y2="44" />
          <line x1="8" y1="44" x2="44" y2="8" />
        </g>
      </g>
      <g
        transform="translate(14 14) scale(0.28)"
        className="builder-icon-pencil"
        // deno-lint-ignore react-no-danger
        dangerouslySetInnerHTML={{ __html: Pencil }}
      />
    </svg>
  );
}
