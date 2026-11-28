import { PostHog } from "posthog-node";

/**
 * PostHog server-side client for capturing analytics events.
 * optional, as it is not needed on localhost or preview envs.
 */
export const posthog = Deno.env.has("POSTHOG_API_KEY")
  ? new PostHog(
    Deno.env.get("POSTHOG_API_KEY") as string,
    {
      host: "https://eu.i.posthog.com",
    },
  )
  : null;
