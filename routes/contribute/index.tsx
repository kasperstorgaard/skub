import { page } from "fresh";

import { Header } from "#/components/header.tsx";
import { Icon, Info } from "#/components/icons.tsx";
import { Main } from "#/components/main.tsx";
import { define } from "#/core.ts";

export const handler = define.handlers({
  GET() {
    return page({});
  },
});

export default define.page<typeof handler>(function ContributePage(props) {
  const url = new URL(props.req.url);

  const repoUrl = "https://github.com/kasperstorgaard/ricochet";

  return (
    <>
      <Main className="max-lg:row-span-full">
        <Header url={url} back={{ href: "/" }} />

        <h1 className="text-5 text-brand mt-2 leading-none">
          How to add a new puzzle
        </h1>

        <div className="flex flex-col gap-fl-4 mt-fl-3 max-w-prose">
          <section className="flex flex-col gap-fl-2">
            <h2 className="text-3 text-text-1">1. Create your puzzle</h2>
            <p className="text-text-2">
              Go to{" "}
              <a href="/puzzles/new">
                /puzzles/new
              </a>{" "}
              and use the editor to design your puzzle. Click a cell to select
              it, then use the toolbar buttons or keyboard shortcuts to place
              walls, pieces, and the destination.
            </p>

            <table className="text-fl-0 border-collapse w-full max-w-sm">
              <thead>
                <tr className="text-left text-text-3 uppercase tracking-wide text-fl-00">
                  <th className="pb-1 pr-4">Key</th>
                  <th className="pb-1">Action</th>
                </tr>
              </thead>
              <tbody className="text-text-2">
                <tr className="border-t border-surface-4">
                  <td className="py-1 pr-4">Click cell</td>
                  <td className="py-1">Select it</td>
                </tr>
                <tr className="border-t border-surface-4">
                  <td className="py-1 pr-4">
                    <kbd>
                      W
                    </kbd>
                  </td>
                  <td className="py-1">Cycle wall at selected cell</td>
                </tr>
                <tr className="border-t border-surface-4">
                  <td className="py-1 pr-4">
                    <kbd>
                      P
                    </kbd>
                  </td>
                  <td className="py-1">Cycle piece at selected cell</td>
                </tr>
                <tr className="border-t border-surface-4">
                  <td className="py-1 pr-4">
                    <kbd>
                      D
                    </kbd>
                  </td>
                  <td className="py-1">Set destination at selected cell</td>
                </tr>
              </tbody>
            </table>

            <p className="text-text-2">
              You can use the <strong>Generate</strong>{" "}
              button to auto-generate a board, then tweak it by hand.<br />
            </p>
            <p>
              You can also go to an existing puzzle and click{" "}
              <strong>Remix</strong> to use it as a starting point.
            </p>

            <blockquote className="callout">
              <Icon icon={Info} />
              <p>
                There is a <strong>Preview</strong>{" "}
                button in the editor that you can use to test your puzzle.
              </p>
            </blockquote>
          </section>

          <section className="flex flex-col gap-fl-2">
            <h2 className="text-3 text-text-1">2. Download the puzzle</h2>
            <p className="text-text-2">
              Once you're happy with your puzzle, click{" "}
              <strong className="text-text-1">Download</strong>{" "}
              in the editor panel.<br /> This saves the puzzle as a{" "}
              <code className="bg-surface-3 px-1 rounded text-fl-0">.md</code>
              {" "}
              file ready to be added to the repo. You can also use{" "}
              <strong className="text-text-1">Import</strong>{" "}
              to load it back into the editor later.
            </p>
          </section>

          <section className="flex flex-col gap-fl-2">
            <h2 className="text-3 text-text-1">3a. Submit a pull request</h2>

            <ol className="flex flex-col gap-fl-1 text-text-2 leading-relaxed pl-fl-2">
              <li>
                Go to the{" "}
                <a
                  href={repoUrl}
                  className=""
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub repository
                </a>
              </li>
              <li>
                Fork the repo (more on this{" "}
                <a
                  href="https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo"
                  target="_blank"
                >
                  here
                </a>)
              </li>
              <li>
                Create a new file at{" "}
                <code className="bg-surface-3 px-1 rounded text-fl-0">
                  static/puzzles/your-slug.md
                </code>{" "}
                and paste the copied markdown
              </li>
              <li>
                Open a pull request, and I'll test, assign difficulty and merge
                your puzzles in
              </li>
            </ol>

            <blockquote className="callout">
              <Icon icon={Info} />
              <p>
                You can also follow the directions from the github README.md on
                how to run the app locally — this will let you save them
                directly to your machine
              </p>
            </blockquote>
          </section>

          <section className="flex flex-col gap-fl-2">
            <h2 className="text-3 text-text-1">3b. Send me an email</h2>
            <p>
              If you know me — just send me puzzles on email, and I'll add them
              😊
            </p>
            <p>
              If you don't know me yet, reach out on{" "}
              <a href="https://www.linkedin.com/in/kasper-storgaard-t-lead">
                LinkedIn
              </a>
            </p>
          </section>
        </div>
      </Main>
    </>
  );
});
