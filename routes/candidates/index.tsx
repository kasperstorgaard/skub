import { clsx } from "clsx/lite";
import { HttpError, page } from "fresh";

import { CandidateCard } from "#/components/candidate-card.tsx";
import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { readCandidates } from "#/game/candidate-store.ts";
import {
  candidateFamilies,
  candidateLabel,
  candidateSource,
  stripVariant,
} from "#/game/candidates.ts";
import type { Board } from "#/game/types.ts";
import { Switch } from "#/islands/switch.tsx";
import { isDev } from "#/lib/env.ts";

type FamilyCard = {
  slug: string;
  label: string;
  board: Board;
  versions: number;
  bestRating?: number;
  promotedAs?: string;
  corpus: boolean;
};

type PageData = { families: FamilyCard[]; hidePromoted: boolean };

export const handler = define.handlers<PageData>({
  async GET(ctx) {
    // Dev-only, like the rest of the candidate routes.
    if (!isDev) throw new HttpError(404, "Not found");

    // Read as stored, no analysis: it's the detail page that brings one current.
    const families = candidateFamilies(await readCandidates()).map((family) => {
      const { shown } = family;
      return {
        slug: shown.slug,
        label: candidateLabel({
          slug: family.base,
          name: stripVariant(shown.name),
        }),
        board: shown.board,
        versions: family.members.length,
        bestRating: family.bestRating,
        promotedAs: family.promotedAs,
        corpus: family.members.some((c) => candidateSource(c) === "corpus"),
      };
    });

    const hidePromoted =
      new URL(ctx.req.url).searchParams.get("hide") === "promoted";

    return page({
      families: hidePromoted
        ? families.filter((family) => !family.promotedAs)
        : families,
      hidePromoted,
    });
  },
});

/** Every board in the candidate store, one card per family, newest first. */
export default define.page<typeof handler>(function CandidatesPage(props) {
  const url = new URL(props.req.url);

  return (
    <Main
      className={clsx(
        "max-lg:row-span-full items-stretch place-content-stretch",
        "lg:max-w-5xl!",
      )}
    >
      <Header url={url} back={{ href: "/" }} />

      <div className="flex items-center justify-between gap-fl-2">
        <div className="flex flex-col gap-0">
          <h1 className="text-brand text-6 leading-flat">Candidates</h1>
          <span className="text-3 text-text-2">
            {props.data.families.length} boards
          </span>
        </div>

        <form method="get" action="/candidates">
          <Switch
            label="Hide promoted"
            name="hide"
            value="promoted"
            checked={props.data.hidePromoted}
          />
          <noscript>
            <button type="submit" className="btn mt-fl-1">Apply</button>
          </noscript>
        </form>
      </div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-fl-3 gap-y-fl-2 auto-rows-min list-none pl-0">
        {props.data.families.map((family) => (
          <li key={family.slug} className="list-none pl-0 min-w-0">
            <CandidateCard {...family} />
          </li>
        ))}
      </ul>
    </Main>
  );
});
