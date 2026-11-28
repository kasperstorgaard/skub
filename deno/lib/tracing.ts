import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("skub");

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
