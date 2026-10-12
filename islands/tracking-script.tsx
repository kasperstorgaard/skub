import { useEffect } from "preact/hooks";

type TrackingProps = {
  // PostHog API key from environment.
  apiKey: string;
  // Whether user has consented to tracking.
  cookieChoice: "accepted" | "declined" | null;
  // User's tracking ID (UUID), or null if not allowed.
  trackingId: string;
};

/**
 * Initializes client-side PostHog analytics when tracking is allowed.
 * Uses /ph proxy to avoid direct connections to PostHog servers.
 * Pageviews are captured server-side, so capture_pageview is disabled.
 * posthog-js is imported after hydration, off the critical path, and only
 * after a cookie choice.
 */
export function TrackingScript(
  { apiKey, cookieChoice, trackingId }: TrackingProps,
) {
  useEffect(() => {
    // Before a choice PostHog captures nothing, so don't load it
    if (!apiKey || !cookieChoice) return;

    let isCancelled = false;

    const start = async () => {
      const { posthog } = await import("posthog-js");
      if (isCancelled) return;

      if (!posthog.__loaded) {
        posthog.init(apiKey, {
          api_host: "/ph",
          ui_host: "https://eu.posthog.com",
          defaults: "2025-11-30",
          cookieless_mode: "on_reject",
        });
      }

      if (cookieChoice === "accepted") {
        posthog.identify(trackingId);
      }

      // Opt in when accepted
      if (
        cookieChoice === "accepted" &&
        !posthog.has_opted_in_capturing()
      ) {
        posthog.opt_in_capturing();
      }

      // Opt out when declined
      if (
        cookieChoice === "declined" &&
        !posthog.has_opted_out_capturing()
      ) {
        posthog.opt_out_capturing();
      }
    };

    start();

    return () => {
      isCancelled = true;
    };
  }, [apiKey, cookieChoice, trackingId]);

  return null;
}
