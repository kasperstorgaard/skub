import type { Signal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { useMemo } from "preact/hooks";

import { Icon, X } from "#/components/icons.tsx";
import type { Solution } from "#/db/types.ts";
import { getReplaySpeed } from "#/game/url.ts";
import { Dialog } from "#/islands/dialog.tsx";

const BASE_URL = "http://example.com";

type Props = {
  href: Signal<string>;
  solution: Omit<Solution, "id" | "name">;
};

const TUTORIAL_STEPS = ["welcome", "pieces", "replay", "solved"] as const;
type TutorialStep = (typeof TUTORIAL_STEPS)[number];

export function TutorialDialog(
  { href, solution }: Props,
) {
  const dialog = useMemo(
    () => new URL(href.value).searchParams.get("dialog"),
    [href.value],
  );

  const step: TutorialStep = useMemo(() => {
    const url = new URL(href.value);
    const rawValue = url.searchParams.get("tutorial_step");
    return TUTORIAL_STEPS.some((value) => value === rawValue)
      ? rawValue as TutorialStep
      : "welcome";
  }, [href.value]);

  const replaySpeed = useMemo(
    () => getReplaySpeed(href.value) ?? 1,
    [href.value],
  );

  const open = dialog === "tutorial";

  return (
    <Dialog
      open={open}
      className={clsx(
        "[animation-fill-mode:forwards]",
        "backdrop:[animation-delay:inherit] backdrop:[animation-fill-mode:forwards]",
        step === "replay" &&
          "opacity-0 animate-fade-in backdrop:opacity-0 backdrop:animate-fade-in",
      )}
      style={{
        animationDelay: `${(1 / replaySpeed) * solution.moves.length}s`,
      }}
    >
      {step === "welcome" && <TutorialWelcomeStep href={href.value} />}
      {step === "pieces" && <TutorialPiecesStep href={href.value} />}
      {step === "replay" && (
        <TutorialReplayStep href={href.value} solution={solution} />
      )}
      {step === "solved" && <TutorialSolveStep href={href.value} />}
    </Dialog>
  );
}

type TutorialStepProps = {
  href: string;
};

function TutorialWelcomeStep({ href }: TutorialStepProps) {
  const nextStep = useMemo(() => getStepLink(href, "pieces"), [
    href,
  ]);

  return (
    <>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h1 className="text-fl-2 leading-flat text-text-1">
          Welcome to <strong className="text-ui-2">Skub!</strong>
        </h1>

        <p>
          A tiny puzzle game where you slide pieces into walls and each other to
          get the puck to the target — in as few moves as possible.
        </p>

        <p className="text-text-3 text-fl-min">
          <em>Skub</em> [ˈsgɔb] means "push" in Danish.
        </p>
      </div>

      <div className="flex w-full">
        <a href="/" className="btn mr-auto">
          Dismiss
        </a>

        <a
          href={nextStep}
          className="btn ml-auto"
          data-router="push"
          autoFocus
        >
          Next
        </a>
      </div>
    </>
  );
}

function TutorialPiecesStep({ href }: TutorialStepProps) {
  const prevStep = useMemo(() => getStepLink(href, "welcome"), [href]);

  const tryItHref = useMemo(() => {
    const url = new URL(href, BASE_URL);
    url.search = "";
    url.searchParams.set("mode", "solve");

    return url.pathname + url.search;
  }, [href]);

  return (
    <>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h1 className="text-fl-2 leading-tight text-text-1">The pieces</h1>
        <p>
          There are two pieces: the puck <IconPuck /> and the blocker{" "}
          <IconBlocker />. Both slide until they hit each other or a
          wa<span className="text-ui-4">ll</span>.
        </p>

        <p>
          Get the puck to stop on the target <IconDestination />{" "}
          and you've found a solution.
        </p>
      </div>

      <div className="flex w-full gap-fl-1 flex-wrap justify-between">
        <a
          href={prevStep}
          className="btn"
          data-router="push"
        >
          Previous
        </a>

        <a
          href={tryItHref}
          className="btn"
        >
          Try it!
        </a>
      </div>
    </>
  );
}

function TutorialReplayStep({ href }: TutorialStepProps & {
  solution: Omit<Solution, "id" | "name">;
}) {
  const prevStep = useMemo(() => getStepLink(href, "pieces"), [href]);
  const reloadStep = useMemo(
    () => getStepLink(href, "replay", { mode: "replay", replaySpeed: 0.667 }),
    [href],
  );

  return (
    <>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h1 className="text-fl-2 leading-tight text-text-1">
          Finding a solution
        </h1>
        <p>
          That's one way to solve it. <a href={reloadStep}>Show again</a>
        </p>

        <p>
          Every puzzle has many solutions, each ranked by number of moves. A new
          puzzle drops every day.
        </p>
      </div>

      <form
        action={href}
        method="POST"
        className="flex w-full gap-fl-1 flex-wrap justify-between"
      >
        <a
          href={prevStep}
          className="btn"
          data-router="push"
        >
          Previous
        </a>

        <a
          href="/"
          className="btn"
        >
          I'm ready
        </a>
      </form>
    </>
  );
}

function TutorialSolveStep({ href }: TutorialStepProps) {
  const prevStep = useMemo(() => getStepLink(href, "pieces"), [href]);

  return (
    <>
      <div className="flex flex-col gap-fl-2 text-text-2">
        <h1 className="text-fl-2 leading-tight text-text-1">
          You found a solution!
        </h1>
        <p>
          Every puzzle has many solutions, each ranked by number of moves.
          Today's puzzle is waiting.
        </p>
      </div>

      <form
        action={href}
        method="POST"
        className="flex w-full gap-fl-1 flex-wrap justify-between"
      >
        <a
          href={prevStep}
          className="btn"
          data-router="push"
        >
          Previous
        </a>

        <a
          href="/"
          className="btn"
        >
          I'm ready
        </a>
      </form>
    </>
  );
}

type GetStepLinkOptions = {
  mode?: "readonly" | "replay" | "solve";
  replaySpeed?: number;
};

function getStepLink(
  href: string,
  step: TutorialStep,
  { mode, replaySpeed }: GetStepLinkOptions = {},
) {
  const url = new URL(href, BASE_URL);
  url.searchParams.set("tutorial_step", step);

  if (mode) url.searchParams.set("mode", mode);
  if (replaySpeed) {
    url.searchParams.set("replay_speed", replaySpeed.toString());
  }

  return url.pathname + url.search;
}

function IconPuck() {
  return (
    <svg viewBox="0 0 50 50" className="inline size-[1em] align-[-0.125em]">
      <circle cx="25" cy="25" r="20" fill="var(--color-ui-2)" />
    </svg>
  );
}

function IconBlocker() {
  return (
    <svg viewBox="0 0 50 50" className="inline size-[1em] align-[-0.125em]">
      <rect
        x="5"
        y="5"
        width="40"
        height="40"
        rx="6"
        ry="6"
        fill="var(--color-ui-3)"
      />
    </svg>
  );
}

function IconDestination() {
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 border border-ui-1">
      <Icon icon={X} className="text-ui-1 text-[1.3em]" />
    </span>
  );
}
