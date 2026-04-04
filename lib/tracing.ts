import {
  context,
  propagation,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";

const tracer = trace.getTracer("skub");

/**
 * Returns the W3C `traceparent` header value for the active span context,
 * or `undefined` if there is no active span. Use this server-side to inject
 * the trace context into rendered HTML so client fetches can be linked.
 */
export function getTraceparent(): string | undefined {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier["traceparent"];
}

/**
 * Runs `fn` inside a named child span, ending it when the function resolves or throws.
 * Exceptions are recorded on the span and re-thrown.
 */
export function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });
}
