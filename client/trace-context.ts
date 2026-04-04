/**
 * Reads the W3C `traceparent` injected by the server into the page `<head>` and
 * returns it as a fetch-ready headers object. Pass the result to `fetch()` so the
 * outgoing request is linked to the server-side trace that rendered the page.
 *
 * Returns an empty object if no meta tag is present (e.g. OTEL not active).
 */
export function addTraceParentHeader(headers: Headers) {
  const meta = globalThis.document?.querySelector<HTMLMetaElement>(
    'meta[name="traceparent"]',
  );
  if (!meta?.content) return headers;

  headers.set("traceparent", meta.content);

  return headers;
}
