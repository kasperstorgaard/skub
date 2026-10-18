import { Icon, RocketLaunch } from "#/components/icons.tsx";
import { Dialog } from "#/islands/dialog.tsx";

/** Why a typed name couldn't ship: another puzzle has it, or it slugs to nothing. */
export type NameError = "taken" | "empty";

type Props = {
  slug: string;
  /** The name to offer: a free suggestion, or the one just rejected. */
  name: string;
  error: NameError | null;
};

/**
 * Picks the name a board ships under, when it has none it can use. Opened by
 * `?dialog=promote`; the form posts to the promote action.
 */
export function PromoteDialog({ slug, name, error }: Props) {
  return (
    <Dialog open>
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
          href={`/candidates/${slug}`}
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
