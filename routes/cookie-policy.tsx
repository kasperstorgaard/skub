import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { define } from "#/core.ts";

const gameCookies = [
  ["user_id", "Ties your solves and name to this device", "5 years"],
  ["profile", "Your name, settings and login email", "5 years"],
  ["progress", "Which puzzles you've solved, and your best moves", "5 years"],
  ["auth_session", "Keeps you logged in", "1 year"],
  ["hint_count", "Hints used on a puzzle", "24 hours"],
  ["flash", "Flash mode on a puzzle", "24 hours"],
  ["flash_explained", "Whether you've seen the Flash dialog", "1 week"],
];

const analyticsCookies = [
  ["tracking_id", "A random id for your visits", "1 year"],
  [
    "ph_…_posthog",
    "PostHog's own id for the same visits, also kept in local storage",
    "1 year",
  ],
];

function CookieTable({ cookies }: { cookies: string[][] }) {
  return (
    <div>
      <table>
        <thead>
          <tr>
            <th align="left">Cookie</th>
            <th align="left">Purpose</th>
            <th align="right">Duration</th>
          </tr>
        </thead>
        <tbody>
          {cookies.map(([name, purpose, duration]) => (
            <tr key={name}>
              <td align="left">{name}</td>
              <td align="left">{purpose}</td>
              <td align="right">{duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default define.page(function CookiePolicyPage() {
  return (
    <>
      <Main className="max-w-prose">
        <article className="grid gap-fl-2">
          <h2 className="text-4 font-semibold mt-fl-4">Cookie policy</h2>

          <p className="text-text-2">
            It's just me building Skub, and I use PostHog to see how it's
            played. Here's everything it sets and sends, whatever you chose.
          </p>

          <h3 className="text-2 font-semibold mt-fl-1">Game cookies</h3>

          <p className="text-text-2">
            Always on. They make the game work, and are never used for
            analytics.
          </p>

          <CookieTable cookies={gameCookies} />

          <p className="text-text-2">
            Logging in happens on Auth0's page, which sets its own cookies
            there.
          </p>

          <h3 className="text-2 font-semibold mt-fl-1">Until you say yes</h3>

          <p className="text-text-2">
            Nothing from your browser is recorded. The game sends a few events,
            like a puzzle being solved, each with a new random id, so they can't
            be tied to you or to each other. If you say no, the tracking_id
            cookie remembers that for a year.
          </p>

          <h3 className="text-2 font-semibold mt-fl-1">If you say yes</h3>

          <p className="text-text-2">
            Two cookies let me follow your visits over time, and the game's
            events carry the same id:
          </p>

          <CookieTable cookies={analyticsCookies} />

          <p className="text-text-2">With them, I see:</p>

          <ul className="text-text-2">
            <li>Which pages you visit and what you click</li>
            <li>How long you play</li>
            <li>
              Recordings of your visits (what's typed into fields is hidden),
              kept for 30 days
            </li>
            <li>Basic technical info (browser, screen size, errors)</li>
          </ul>

          <h3 className="text-2 font-semibold mt-fl-1">What I don't do</h3>

          <ul className="text-text-2 leading-relaxed">
            <li>Sell your data</li>
            <li>Share it with advertisers</li>
            <li>Track you across other websites</li>
            <li>Send your email to analytics</li>
            <li>Keep your IP address</li>
          </ul>

          <p className="text-text-2">
            Analytics are stored with PostHog in the EU. To change your mind,
            clear Skub's cookies and the question comes back.
          </p>

          <p className="mt-fl-2 border-t border-surface-3 text-text-3 text-0">
            Last updated: November 2026
          </p>
        </article>
      </Main>

      <Panel />
    </>
  );
});
