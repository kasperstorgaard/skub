/** Shared formatting and statistics for the scoring reports. */

export const f = (n: number): string => Number.isFinite(n) ? n.toFixed(3) : "—";

export const mean = (values: number[]): number =>
  values.length
    ? values.reduce((sum, v) => sum + v, 0) / values.length
    : Number.NaN;

/** `min / median / max`, or a dash when there's nothing to summarise. */
export function quantiles(values: number[]): string {
  if (!values.length) return "—";
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return `${f(sorted[0])} / ${f(median)} / ${f(sorted.at(-1)!)}`;
}

export function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

/** Ranks, ties averaged — the standard Spearman treatment. */
function ranks(values: number[]): number[] {
  const order = values
    .map((value, index) => [value, index] as const)
    .sort((a, b) => a[0] - b[0]);

  const out = new Array<number>(values.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
    const averageRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) out[order[k][1]] = averageRank;
    i = j + 1;
  }
  return out;
}

/** Spearman ρ — the Pearson correlation of the two rank vectors. */
export function spearman(a: number[], b: number[]): number {
  const ra = ranks(a);
  const rb = ranks(b);
  const meanA = mean(ra);
  const meanB = mean(rb);

  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let i = 0; i < ra.length; i++) {
    covariance += (ra[i] - meanA) * (rb[i] - meanB);
    varianceA += (ra[i] - meanA) ** 2;
    varianceB += (rb[i] - meanB) ** 2;
  }

  return varianceA && varianceB
    ? covariance / Math.sqrt(varianceA * varianceB)
    : 0;
}

/** Writes a report, creating its directory. */
export async function writeReport(path: string, markdown: string) {
  const dir = path.slice(0, path.lastIndexOf("/"));
  if (dir) await Deno.mkdir(dir, { recursive: true });
  await Deno.writeTextFile(path, markdown);
}
