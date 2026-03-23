import { clsx } from "clsx/lite";

import { define } from "#/core.ts";
import { CookieBanner } from "#/islands/cookie-banner.tsx";
import { Router } from "#/islands/router.tsx";
import { TrackingScript } from "#/islands/tracking-script.tsx";

export default define.page(
  function AppWrapper({ Component, state, url }) {
    // Don't show the cookie dialog on tutorial, too distracting and double modal.
    const isTutorial = url.pathname.endsWith("/tutorial");

    // Add og:image for puzzle pages (/puzzles/[slug] and /puzzles/[slug]/solutions)
    const puzzleSlugMatch = url.pathname.match(
      /^\/puzzles\/([^/]+)(?:\/|$)/,
    );
    const puzzleSlug = puzzleSlugMatch?.[1];
    const ogExcluded = ["new", "tutorial", "daily", "preview"];
    const ogSlug = puzzleSlug && !ogExcluded.includes(puzzleSlug)
      ? puzzleSlug
      : null;

    return (
      <html
        className="min-h-dvh"
        data-theme={state.user.theme ?? "skub"}
      >
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Skub</title>
          <meta property="og:title" content="Skub" />
          <meta
            property="og:description"
            content="Slide pieces to reach the target. No stops, no turns. Fewest moves wins."
          />
          {ogSlug && (
            <meta
              property="og:image"
              content={`${url.origin}/puzzles/${ogSlug}/og-image`}
            />
          )}
          <link
            rel="preload"
            as="font"
            type="font/woff2"
            href="/fonts/chakra-petch-400.woff2"
            crossOrigin="anonymous"
          />

          <link rel="icon" type="image/svg+xml" href="/favicon-light.svg" />
          <link
            rel="icon"
            type="image/svg+xml"
            href="/favicon-dark.svg"
            media="(prefers-color-scheme: dark)"
          />
          {/* Tiny script to indicate JavaScript is enabled, needed for styling */}
          <script
            // deno-lint-ignore react-no-danger
            dangerouslySetInnerHTML={{
              __html: `document.documentElement.setAttribute("data-js","")`,
            }}
          />
        </head>

        <body
          className={clsx(
            "grow grid grid-cols-[minmax(var(--size-fluid-3),auto)_1fr_minmax(var(--size-fluid-3),auto)]",
            "sm:grid-cols-[minmax(var(--size-fluid-3),auto)_max-content_minmax(var(--size-fluid-3),auto)]",
            "grid-rows-[auto_auto_1fr_auto] place-items-[flex-end_center] gap-y-fl-3",
            "lg:grid-cols-[1fr_16rem] lg:grid-rows-[minmax(6rem,auto)_auto_1fr_auto] lg:content-center",
            "print:grid-cols-[1fr_max-content_1fr] print:grid-rows-[auto_1fr] print:gap-0",
          )}
        >
          <Component />
          {!isTutorial && (
            <CookieBanner
              open={!state.cookieChoice}
            />
          )}
          <TrackingScript
            apiKey={Deno.env.get("POSTHOG_API_KEY")!}
            cookieChoice={state.cookieChoice}
            trackingId={state.trackingId}
          />
          <Router />
        </body>
      </html>
    );
  },
);
