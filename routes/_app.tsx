import { clsx } from "clsx/lite";
import { asset, Partial } from "fresh/runtime";

import { CookieBanner } from "#/components/cookie-banner.tsx";
import { define } from "#/core.ts";
import { Router } from "#/islands/router.tsx";
import { TrackingScript } from "#/islands/tracking-script.tsx";
import { sharedChunks } from "#/lib/shared-chunks.ts";
import { THEME_ASSETS } from "#/lib/theme-assets.ts";
import { resolveTheme } from "#/lib/themes.ts";

export default define.page(
  function AppWrapper({ Component, state, url }) {
    // Don't show the cookie dialog on tutorial, too distracting and double modal.
    const isTutorial = url.pathname.endsWith("/tutorial");

    // Add og:image for puzzle pages (/puzzles/[slug] and /puzzles/[slug]/solutions)
    const puzzleSlugMatch = url.pathname.match(
      /^\/puzzles\/([^/]+)(?:\/|$)/,
    );
    const puzzleSlug = puzzleSlugMatch?.[1];
    const ogExcluded = ["new", "tutorial", "preview"];
    const ogSlug = puzzleSlug && !ogExcluded.includes(puzzleSlug)
      ? puzzleSlug
      : null;

    // user is unset when middleware throws before it runs (error page).
    // A theme without a stylesheet yet renders as skub.
    const resolved = resolveTheme(state.user?.theme);
    const theme = resolved in THEME_ASSETS ? resolved : "skub";
    const themeAssets = THEME_ASSETS[theme];

    return (
      <html
        className="min-h-dvh"
        lang="en"
        data-theme={theme}
      >
        <head>
          <meta charset="utf-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Skub</title>
          <meta
            name="description"
            content="Slide the puck to the target. Fewest moves wins."
          />
          <meta property="og:title" content="Skub" />
          <meta
            property="og:description"
            content="Slide the puck to the target. Fewest moves wins."
          />
          {ogSlug && (
            <meta
              property="og:image"
              content={`${url.origin}/puzzles/${ogSlug}/og-image`}
            />
          )}
          {themeAssets.fonts.map((href) => (
            <link
              key={href}
              rel="preload"
              as="font"
              type={href.endsWith(".woff") ? "font/woff" : "font/woff2"}
              href={href}
              crossOrigin="anonymous"
            />
          ))}
          {themeAssets.css && <link rel="stylesheet" href={themeAssets.css} />}

          {sharedChunks.map((href) => (
            <link key={href} rel="modulepreload" href={href} />
          ))}

          <link
            rel="icon"
            type="image/svg+xml"
            href={asset("/favicon-light.svg")}
          />
          <link
            rel="icon"
            type="image/svg+xml"
            href={asset("/favicon-dark.svg")}
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
            // 16 rem is the sidebar, 6rem is a min height on the first row
            "lg:grid-cols-[1fr_16rem] lg:grid-rows-[minmax(6rem,auto)_auto_1fr_auto] lg:content-center",
            "print:grid-cols-[1fr_max-content_1fr] print:grid-rows-[auto_1fr] print:gap-0",
          )}
        >
          {/* Dookie's hand-drawn wobble; CSS filters can't reach an SVG file */}
          {theme === "dookie" && (
            <svg aria-hidden="true" width="0" height="0" className="absolute">
              <filter id="dookie-wobble">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.04"
                  numOctaves="2"
                  seed="3"
                />
                <feDisplacementMap in="SourceGraphic" scale="2.5" />
              </filter>
            </svg>
          )}
          <Partial name="body">
            <Component />
          </Partial>
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
