import { trace } from "@opentelemetry/api";

import { define } from "#/core.ts";
import { withKvUsage } from "#/db/kv.ts";
import { updateHeaders } from "#/lib/headers.ts";

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
    return updateHeaders(res, (headers) =>
      headers.set(
        "Server-Timing",
        `kv;dur=${usage.ms.toFixed(1)};desc="${usage.ops} ops"`,
      ));
  } finally {
    span?.setAttributes({ "kv.ops": usage.ops, "kv.ms": Math.round(usage.ms) });
  }
});
