import { trace } from "@opentelemetry/api";

import { define } from "#/core.ts";
import { withKvUsage } from "#/db/kv.ts";

/**
 * Annotates the active OTEL span with useful request attributes, and reports
 * the request's KV op count and time on the span and as `Server-Timing`.
 */
export const telemetry = define.middleware(async (ctx) => {
  const span = trace.getActiveSpan();

  const ua = ctx.req.headers.get("user-agent");

  if (ua) span?.setAttribute("http.user_agent", ua);

  const usage = { ops: 0, ms: 0 };
  try {
    const res = await withKvUsage(usage, () => ctx.next());
    return withHeader(
      res,
      "Server-Timing",
      `kv;dur=${usage.ms.toFixed(1)};desc="${usage.ops} ops"`,
    );
  } finally {
    span?.setAttributes({ "kv.ops": usage.ops, "kv.ms": Math.round(usage.ms) });
  }
});

/** Sets a header, copying the response when its headers are immutable (`Response.redirect`). */
function withHeader(res: Response, name: string, value: string) {
  try {
    res.headers.set(name, value);
    return res;
  } catch {
    const copy = new Response(res.body, res);
    copy.headers.set(name, value);
    return copy;
  }
}
