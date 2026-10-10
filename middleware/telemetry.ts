import { trace } from "@opentelemetry/api";

import { define } from "#/core.ts";
import { withKvUsage } from "#/db/kv.ts";

/**
 * Annotates the active OTEL span with useful request attributes, including
 * the request's KV op count and time.
 */
export const telemetry = define.middleware(async (ctx) => {
  const span = trace.getActiveSpan();

  const ua = ctx.req.headers.get("user-agent");

  if (ua) span?.setAttribute("http.user_agent", ua);

  const usage = { ops: 0, ms: 0 };
  try {
    return await withKvUsage(usage, () => ctx.next());
  } finally {
    span?.setAttributes({ "kv.ops": usage.ops, "kv.ms": Math.round(usage.ms) });
  }
});
