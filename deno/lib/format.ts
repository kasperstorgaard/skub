const numberFormat = new Intl.NumberFormat();

/** A number grouped the way the locale groups it, e.g. 1,250. */
export function formatNumber(value: number): string {
  return numberFormat.format(value);
}
