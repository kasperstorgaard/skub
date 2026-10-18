import type { Signal } from "@preact/signals";
import { useCallback, useMemo } from "preact/hooks";

import { Icon, RocketLaunch } from "#/components/icons.tsx";
import { Dialog } from "#/islands/dialog.tsx";
import { useRouter } from "#/islands/router.tsx";

type Props = {
  href: Signal<string>;
  slug: string;
  /** A free name to offer, chosen by the server. */
  suggestion: string;
};

/**
 * Picks the name a board ships under, when it has none it can use. Driven by
 * `?dialog=promote`; a rejected name comes back as `name`, with `error` saying
 * why. The form posts to the promote action.
 */
export function PromoteDialog({ href, slug, suggestion }: Props) {
  const onLocationUpdated = useCallback((url: URL) => {
    href.value = url.href;
  }, []);

  useRouter({ onLocationUpdated });

  const params = useMemo(() => new URL(href.value).searchParams, [href.value]);
  const error = params.get("error");
  const name = params.get("name") ?? suggestion;

  const closeHref = useMemo(() => {
    const url = new URL(href.value);
    for (const key of ["dialog", "error", "name"]) url.searchParams.delete(key);
    return url.href;
  }, [href.value]);

  return (
    <Dialog open={params.get("dialog") === "promote"}>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h2 className="text-fl-2 font-semibold text-text-1">Name the puzzle</h2>
        {error === "taken" && <p>{name} is already in use.</p>}
        {error === "empty" && <p>Use letters or numbers in the name.</p>}
      </div>

      <form
        id="promote"
        action={`/candidates/${slug}/promote`}
        method="post"
        className="flex flex-col gap-1"
      >
        <label className="flex flex-col gap-1">
          <span className="text-text-2 text-1">Name</span>
          <input
            name="name"
            defaultValue={name}
            required
            className="border border-surface-4 p-2 bg-surface-2 text-2 rounded-1"
          />
        </label>
      </form>

      <div className="flex gap-fl-2 justify-between flex-wrap w-full max-md:flex-col-reverse">
        <a
          href={closeHref}
          data-router="replace"
          className="flex items-center text-text-2 max-md:justify-center"
        >
          Cancel
        </a>

        <button form="promote" type="submit" className="btn">
          <Icon icon={RocketLaunch} /> Promote
        </button>
      </div>
    </Dialog>
  );
}
