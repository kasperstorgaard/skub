import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { define } from "#/core.ts";

export default define.page(function CookiePolicyPage() {
  return (
    <>
      <Main className="max-w-prose">
        <article className="grid gap-fl-2">
          <h2 className="text-4 font-semibold mt-fl-4">Cookie Policy</h2>

          <p className="text-text-2">
            Skub uses a single first-party cookie to understand how people use
            the game. That's it. (and it's opt in)
          </p>

          <h3 className="text-2 font-semibold mt-fl-1">
            What cookie do we use?
          </h3>

          <div>
            <table>
              <thead>
                <tr>
                  <th align="left">Cookie Name</th>
                  <th align="left">Purpose</th>
                  <th align="right">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td align="left">
                    tracking_id
                  </td>
                  <td align="left">
                    Identifies your session in PostHog analytics so we can see
                    how the game is being used
                  </td>
                  <td align="right">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-2 font-semibold mt-fl-1">What is PostHog?</h3>
          <p className="text-text-2">
            PostHog is an analytics platform that helps us understand how people
            interact with Skub. It tells us things like which puzzles people
            play, where they get stuck, and what features are actually being
            used.
          </p>

          <h3 className="text-2 font-semibold mt-fl-1">
            What data is collected?
          </h3>

          <p className="text-text-2">When you opt in, we collect:</p>

          <ul className="text-text-2">
            <li>Which pages you visit in the game</li>
            <li>What buttons you click</li>
            <li>How long you play</li>
            <li>Basic technical info (browser type, screen size)</li>
          </ul>

          <h3 className="text-2 font-semibold mt-fl-1">
            What we DON'T do
          </h3>
          <p className="text-text-2">We don't:</p>
          <ul className="text-text-2 leading-relaxed">
            <li>Sell your data to anyone</li>
            <li>Share it with advertisers</li>
            <li>Track you across other websites</li>
            <li>
              Collect personal information like your name or email
            </li>
          </ul>

          <p className="mt-fl-2 mt-fl-2 border-t border-surface-3 text-text-3 text-0">
            Last updated: February 2026
          </p>
        </article>
      </Main>

      <Panel />
    </>
  );
});
