import { useSignal } from "@preact/signals";
import { clsx } from "clsx/lite";
import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";
import { getUserPuzzleDraft, newPuzzleDraft } from "#/db/user.ts";
import type { SolveState } from "#/game/solver.ts";
import type { Puzzle } from "#/game/types.ts";
import Board from "#/islands/board.tsx";
import { EditableName } from "#/islands/editable-name.tsx";
import { EditorAutosave } from "#/islands/editor-autosave.tsx";
import { EditorKeyboardShortcuts } from "#/islands/editor-keyboard-shortcuts.tsx";
import { EditorNudge } from "#/islands/editor-nudge.tsx";
import { EditorPanel } from "#/islands/editor-panel.tsx";
import { type EditorSolution, EditorSolver } from "#/islands/editor-solver.tsx";
import { EditorToolbar } from "#/islands/editor-toolbar.tsx";
import { SolutionBadge } from "#/islands/solution-badge.tsx";
import { SubmitDialog } from "#/islands/submit-dialog.tsx";
import { canSendEmail } from "#/lib/email.ts";
import { isDev } from "#/lib/env.ts";

export const handler = define.handlers<Puzzle>({
  async GET(ctx) {
    const puzzle = await getUserPuzzleDraft(ctx.state.userId) ??
      newPuzzleDraft();

    return page(puzzle);
  },
});

export default define.page<typeof handler>(function EditorPage(props) {
  const puzzle = useSignal(props.data);
  const href = useSignal(props.url.href);
  const mode = useSignal<"editor">("editor");
  const solveState = useSignal<SolveState | undefined>(undefined);
  const solution = useSignal<EditorSolution | null>(null);
  const showSolution = useSignal(false);
  // Submissions are emailed, so sending needs somewhere to send them.
  const submissionsEnabled = canSendEmail && Deno.env.has("SUBMISSIONS_EMAIL");

  return (
    <>
      <Main className="lg:relative">
        <Header back={{ href: "/" }} />

        <div className="flex items-end justify-between gap-fl-1 flex-wrap">
          <div className="flex flex-col group">
            <p
              className={clsx(
                "m-0 text-3 [font-weight:300] leading-none text-text-2",
                "group-focus-within:opacity-0 transition-opacity",
              )}
            >
              Build a puzzle
            </p>

            <EditableName
              puzzle={puzzle}
              defaultValue="Untitled"
              className="type-title-lg font-5 leading-none text-text-1"
            />
          </div>

          <SolutionBadge
            puzzle={puzzle}
            solveState={solveState}
            showSolution={showSolution}
          />
        </div>

        <div className="relative">
          <Board
            puzzle={puzzle}
            href={href}
            mode={mode}
            solution={solution}
            showSolution={showSolution}
            className="lg:col-[1/2] lg:row-[4/5]"
          />

          <EditorToolbar
            puzzle={puzzle}
            href={href}
            className={clsx(
              "max-lg:mt-fl-3",
              "lg:absolute lg:ml-fl-1 lg:left-full lg:top-1/2 lg:-translate-y-1/2",
            )}
          />

          {/* The puzzle page's nudge spot: empty until the board can be sent */}
          {submissionsEnabled && (
            <div className="max-w-2xs mx-auto mt-fl-2 empty:hidden print:hidden">
              <EditorNudge
                puzzle={puzzle}
                href={href}
                solveState={solveState}
              />
            </div>
          )}
        </div>
      </Main>
      <EditorPanel puzzle={puzzle} href={href} isDev={isDev} />
      <SubmitDialog
        puzzle={puzzle}
        href={href}
        solveState={solveState}
        userEmail={props.state.user.email}
      />
      <EditorSolver
        puzzle={puzzle}
        solveState={solveState}
        solution={solution}
      />
      <EditorAutosave puzzle={puzzle} />
      <EditorKeyboardShortcuts
        puzzle={puzzle}
        href={href}
        showSolution={showSolution}
      />
    </>
  );
});
