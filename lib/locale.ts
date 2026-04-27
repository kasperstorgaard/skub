/**
 * Picks a single locale tag from an Accept-Language header (highest q-weight),
 * or undefined if the header is absent/empty.
 */
export function pickLocale(acceptLanguage: string | null): string | undefined {
  if (!acceptLanguage) return undefined;
  const candidates = acceptLanguage.split(",")
    .map((part) => {
      const [tag, ...rest] = part.trim().split(";");
      const qPart = rest.find((p) => p.trim().startsWith("q="));
      const q = qPart ? parseFloat(qPart.split("=")[1]) : 1;
      return { tag: tag.trim(), q: isNaN(q) ? 1 : q };
    })
    .filter((c) => c.tag && c.tag !== "*")
    .sort((a, b) => b.q - a.q);
  return candidates[0]?.tag;
}
