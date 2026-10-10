import {
  context,
  createContextKey,
  type Span,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";

type KvUsage = { ops: number; ms: number };

const tracer = trace.getTracer("skub");
const usageKey = createContextKey("skub.kv_usage");

/**
 * Runs `fn` with a request-scoped KV counter; every traced KV op inside it
 * adds to `usage`.
 */
export function withKvUsage<T>(usage: KvUsage, fn: () => T): T {
  return context.with(context.active().setValue(usageKey, usage), fn);
}

function getKeyPrefix(key: Deno.KvKey | undefined) {
  const part = key?.[0];
  return typeof part === "string" ? part : "unknown";
}

/**
 * Starts a `db.kv.<op>` span; the returned callback ends it and records the
 * op on the request's KV counter. Only the first key segment is recorded —
 * keys carry user ids.
 */
function startKvSpan(op: string, key: Deno.KvKey | undefined) {
  const span = tracer.startSpan(`db.kv.${op}`, {
    attributes: { "kv.key_prefix": getKeyPrefix(key) },
  });
  const usage = context.active().getValue(usageKey) as KvUsage | undefined;
  const start = performance.now();

  return (err?: unknown) => {
    if (usage) {
      usage.ops++;
      usage.ms += performance.now() - start;
    }
    if (err) recordError(span, err);
    span.end();
  };
}

function recordError(span: Span, err: unknown) {
  span.recordException(err as Error);
  span.setStatus({ code: SpanStatusCode.ERROR });
}

async function traced<T>(
  op: string,
  key: Deno.KvKey | undefined,
  fn: () => Promise<T>,
) {
  const end = startKvSpan(op, key);
  try {
    const result = await fn();
    end();
    return result;
  } catch (err) {
    end(err);
    throw err;
  }
}

function traceList<T>(
  iter: Deno.KvListIterator<T>,
  selector: Deno.KvListSelector,
) {
  const key = "prefix" in selector ? selector.prefix : selector.start;
  const end = startKvSpan("list", key);
  const next = iter.next.bind(iter);

  // Spans the whole iteration; every caller exhausts the iterator.
  iter.next = async () => {
    try {
      const res = await next();
      if (res.done) end();
      return res;
    } catch (err) {
      end(err);
      throw err;
    }
  };
  return iter;
}

function traceAtomic(op: Deno.AtomicOperation) {
  let key: Deno.KvKey | undefined;
  const { check, set, delete: del, commit } = op;

  op.check = (...checks) => {
    key ??= checks[0]?.key;
    return check.apply(op, checks);
  };
  op.set = (k, ...rest) => {
    key ??= k;
    return set.call(op, k, ...rest);
  };
  op.delete = (k) => {
    key ??= k;
    return del.call(op, k);
  };
  op.commit = () => traced("commit", key, () => commit.call(op));
  return op;
}

function instrument(kv: Deno.Kv): Deno.Kv {
  return new Proxy(kv, {
    get(target, prop) {
      switch (prop) {
        case "get":
          return (
            key: Deno.KvKey,
            options?: { consistency?: Deno.KvConsistencyLevel },
          ) => traced("get", key, () => target.get(key, options));
        case "getMany":
          return (
            keys: Deno.KvKey[],
            options?: { consistency?: Deno.KvConsistencyLevel },
          ) => traced("get_many", keys[0], () => target.getMany(keys, options));
        case "set":
          return (
            key: Deno.KvKey,
            value: unknown,
            options?: { expireIn?: number },
          ) => traced("set", key, () => target.set(key, value, options));
        case "delete":
          return (key: Deno.KvKey) =>
            traced("delete", key, () => target.delete(key));
        case "list":
          return (
            selector: Deno.KvListSelector,
            options?: Deno.KvListOptions,
          ) => traceList(target.list(selector, options), selector);
        case "atomic":
          return () => traceAtomic(target.atomic());
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const kv = instrument(await Deno.openKv());
