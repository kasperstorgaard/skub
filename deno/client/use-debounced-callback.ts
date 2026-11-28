import { debounce } from "@std/async/debounce";
import { useEffect, useRef } from "preact/hooks";

/**
 * Returns a debounced version of `fn` that always calls the latest closure.
 * The returned function exposes `.clear()` and `.flush()` from `@std/async`.
 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const debounced = useRef(
    debounce((...args: A) => fnRef.current(...args), delay),
  );

  useEffect(() => () => debounced.current.clear(), []);

  return debounced.current;
}
