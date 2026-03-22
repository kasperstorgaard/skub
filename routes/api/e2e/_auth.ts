const E2E_SECRET = Deno.env.get("E2E_SECRET");

export function isAuthorized(req: Request): boolean {
  if (!E2E_SECRET) return false;
  if (new URL(req.url).hostname === "skub.app") return false;
  return req.headers.get("x-e2e-secret") === E2E_SECRET;
}
