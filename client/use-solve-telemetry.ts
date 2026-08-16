import type { Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { observe } from "#/client/solve-telemetry.ts";

/** Records solve interactions from the url the board writes moves into. */
export function useSolveTelemetry(
  href: Signal<string>,
  slug: string,
  isEnabled: boolean,
): void {
  useEffect(() => {
    if (isEnabled) observe(slug, href.value);
  }, [href.value, slug, isEnabled]);
}
