import { define } from "#/core.ts";

/**
 * Middleware that proxies /ph/* requests to PostHog servers.
 *
 * This allows the client-side PostHog SDK to send events through our server,
 * avoiding direct connections to PostHog (better for privacy and ad blockers).
 *
 * Routes:
 * - /ph/static/* -> eu-assets.i.posthog.com (JS bundles, etc.)
 * - /ph/* -> eu.i.posthog.com (API endpoints)
 */
export const posthogProxy = define.middleware(async (ctx) => {
  const url = new URL(ctx.req.url);

  if (!url.pathname.startsWith("/ph/")) return ctx.next();

  const path = url.pathname.replace(/^\/ph\//, "");
  const { method, body } = ctx.req;

  const targetUrl = path.startsWith("static/")
    ? `https://eu-assets.i.posthog.com/${path}${url.search}`
    : `https://eu.i.posthog.com/${path}${url.search}`;

  // Forward headers (remove host)
  const headers = new Headers(ctx.req.headers);
  headers.delete("host");

  const response = await fetch(targetUrl, {
    method,
    headers,
    body: method === "POST" ? body : undefined,
  });

  // fetch already decoded the body
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
});
