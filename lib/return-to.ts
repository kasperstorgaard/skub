/**
 * Resolves a `return_to` value to a same-origin path, or `/` when it points
 * anywhere else. A bare `startsWith("/")` check lets `//host` and `/\host`
 * through, which browsers read as protocol-relative URLs.
 */
export function getReturnTo(raw: string | null, origin: string): string {
  if (!raw) return "/";

  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return "/";
  }

  if (url.origin !== origin) return "/";

  return url.pathname + url.search + url.hash;
}
