import { clsx } from "clsx/lite";
import { HttpError } from "fresh";
import { ComponentChildren } from "preact";

import { Header } from "#/components/header.tsx";
import { Main } from "#/components/main.tsx";
import { Panel } from "#/components/panel.tsx";
import { define } from "#/core.ts";
import { isDev } from "#/lib/env.ts";
import { posthog } from "#/lib/posthog.ts";

export default define.page(function ErrorPage(props) {
  const error = props.error;

  let status = 500;
  let title = "Something went wrong";
  let message = "An unexpected error occurred.";

  if (error instanceof Error) {
    message = error.message;
  }

  if (error instanceof HttpError) {
    status = error.status;
    message = error.message;
  }

  if (status === 404) {
    title = "Page not found";

    message = "The page you were looking for doesn't exist.";
  }

  if (status === 400) {
    title = "That's not good";
    if (!message) message = "The request doesn't seem to be valid.";
  }

  const trackingId = props.state.trackingId;
  const trackingData = {
    $current_url: props.url.href,
    status,
  };

  // Track error to posthog, but not locally
  if (!isDev) {
    posthog?.captureException(error, trackingId, trackingData);
  }

  return (
    <>
      <Main className="max-lg:row-span-full">
        <Header back={{ href: "/" }} />

        <div className="flex flex-col gap-fl-2 py-fl-3">
          <ErrorAnimation status={status}>
            <div className="flex col-[2/8] row-[2/4] items-center justify-center bg-surface-2 h-full w-full px-2">
              <h1 className="text-brand text-fl-2 leading-flat">
                {title}
              </h1>
            </div>
          </ErrorAnimation>

          <p className="text-fl-1 text-text-2">{message}</p>
        </div>
      </Main>

      <Panel />
    </>
  );
});

type ErrorAnimationProps = {
  children?: ComponentChildren;
  status: number;
};

function ErrorAnimation({ children, status }: ErrorAnimationProps) {
  const wallX = status === 404 ? null : 4;
  const cols = 8;
  const rows = 4;

  return (
    <>
      <div
        style={{
          "--gap": "var(--size-1)",
          "--space-w": "clamp(32px, 8vw, 48px)",
        }}
        className="grid gap-(--gap) grid-cols-[repeat(8,var(--space-w))] grid-rows-[repeat(2,var(--space-w))]"
      >
        {/* Board spaces */}
        {Array.from({ length: cols * rows }).map((_, i) => (
          <div
            key={i}
            className={clsx(
              "aspect-square rounded-1",
              "border-1 border-stone-9 border-r-stone-7 border-b-stone-7",
              wallX && i === wallX + 1 && "border-l-2 border-l-ui-4",
            )}
            style={{
              gridColumnStart: `${i % cols + 1}`,
              gridColumnEnd: `${i % cols + 2}`,
              gridRowStart: `${Math.floor(i / cols) + 1}`,
              gridRowEnd: `${Math.floor(i / cols) + 2}`,
            }}
          />
        ))}

        {/* Destination */}
        {status !== 404 && (
          <div className="col-7 row-1 aspect-square place-self-center border-2 border-ui-1 pointer-events-none">
            <svg className="text-ui-1" viewBox="0 0 100 100">
              <line
                x1={0}
                y1={0}
                x2={100}
                y2={100}
                strokeWidth={3}
                stroke="currentColor"
              />
              <line
                x1={0}
                y1={100}
                x2={100}
                y2={0}
                strokeWidth={3}
                stroke="currentColor"
              />
            </svg>
          </div>
        )}

        {/* Puck */}
        <div
          className={clsx(
            "col-1 row-1 p-(--pad)",
            "w-full aspect-square place-self-center",
            "translate-x-[calc((var(--space-w)+var(--gap))*var(--x))]",
            "translate-y-[calc((var(--space-w)+var(--gap))*var(--y,0))]",
            "transition-transform ease-out",
          )}
          style={{
            "--pad": "var(--size-2)",
            animation: status === 404
              ? "puck-404 4s ease-in-out infinite"
              : "puck-500 3s ease-in-out infinite",
          }}
        >
          <div className="w-full h-full bg-ui-2 rounded-round" />
        </div>

        {children}

        <div className="col-1 row-[1/5] flex w-full items-center justify-center">
          <h2 className="leading-flat text-fl-2 text-center [text-orientation:upright] [writing-mode:vertical-rl] tracking-[-0.4em]">
            {status}
          </h2>
        </div>
      </div>

      {
        /*
        Custom animations:
        - 404: Puck moves around the perimeter of the board (no destination)
        - 500: Puck bumps repeatedly against the wall
      */
      }
      <style>
        {`
        @keyframes puck-404 {
          0%, 10% { --x: 0; --y: 0 }
          25%, 35% { --x: ${cols - 1}; --y: 0 }
          50%, 60% { --x: ${cols - 1}; --y: ${rows - 1} }
          75%, 85% { --x: 0; --y: ${rows - 1} }
        }

        @keyframes puck-500 {
          0%, 10% { --x: 0 }
          35%, 70% { --x: ${wallX} }
          90%, 100% { --x: 0 }
        }
      `}
      </style>
    </>
  );
}
