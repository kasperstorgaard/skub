import { context, createContextKey } from "@opentelemetry/api";

import { withSpan } from "#/lib/tracing.ts";

type KvUsage = { ops: number; ms: number };
type Tracker = { usage: KvUsage; pending: number; since: number };

const trackerKey = createContextKey("skub.kv_tracker");

/**
 * Runs `fn` with a request-scoped KV counter; every KV op inside it adds to
 * `usage`.
 */
export function withKvUsage<T>(usage: KvUsage, fn: () => T): T {
  const tracker: Tracker = { usage, pending: 0, since: 0 };
  return context.with(context.active().setValue(trackerKey, tracker), fn);
}

/**
 * Counts one op. `ms` is wall-clock time with any op pending, so parallel ops
 * count once.
 */
function track(): Disposable {
  const tracker = context.active().getValue(trackerKey) as Tracker | undefined;
  if (!tracker) return { [Symbol.dispose]() {} };

  tracker.usage.ops++;
  if (tracker.pending++ === 0) tracker.since = performance.now();

  return {
    [Symbol.dispose]() {
      if (--tracker.pending === 0) {
        tracker.usage.ms += performance.now() - tracker.since;
      }
    },
  };
}

/** Runs a KV call in a `db.kv.<op>` span. Only the first key segment is recorded — keys carry user ids. */
function traced<T>(
  op: string,
  key: Deno.KvKey | undefined,
  fn: () => Promise<T>,
) {
  return withSpan(`db.kv.${op}`, async (span) => {
    if (typeof key?.[0] === "string") {
      span.setAttribute("kv.key_prefix", key[0]);
    }
    using _ = track();
    // Awaited so the op stays pending until it settles.
    return await fn();
  });
}

/** Reads the whole list inside the span, so loop bodies aren't timed as KV. No `cursor`. */
async function* tracedList<T>(
  kv: Deno.Kv,
  selector: Deno.KvListSelector,
  options?: Deno.KvListOptions,
) {
  const key = "prefix" in selector ? selector.prefix : selector.start;
  yield* await traced(
    "list",
    key,
    () => Array.fromAsync(kv.list<T>(selector, options)),
  );
}

function instrument(kv: Deno.Kv): Deno.Kv {
  return new Proxy(kv, {
    get(target, prop) {
      switch (prop) {
        case "get":
          return (...args: Parameters<Deno.Kv["get"]>) =>
            traced("get", args[0], () => target.get(...args));
        case "getMany":
          return (...args: Parameters<Deno.Kv["getMany"]>) =>
            traced("get_many", args[0][0], () => target.getMany(...args));
        case "set":
          return (...args: Parameters<Deno.Kv["set"]>) =>
            traced("set", args[0], () => target.set(...args));
        case "delete":
          return (...args: Parameters<Deno.Kv["delete"]>) =>
            traced("delete", args[0], () => target.delete(...args));
        case "list":
          return (...args: Parameters<Deno.Kv["list"]>) =>
            tracedList(target, ...args);
        case "atomic":
          return () => {
            const op = target.atomic();
            const commit = op.commit.bind(op);
            op.commit = () => traced("commit", undefined, commit);
            return op;
          };
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const kv = instrument(await Deno.openKv());
