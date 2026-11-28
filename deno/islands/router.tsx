import { useEffect } from "preact/hooks";

/**
 * Helper function to update client side routing
 * using custom event "location-changed".
 */
function updateLocation(href: string, options?: { replace?: boolean }) {
  if (options?.replace) {
    self.history.replaceState({}, "", href);
  } else {
    self.history.pushState({}, "", href);
  }

  self.dispatchEvent(new CustomEvent("location-changed"));
}

/**
 * Simple client side router to progressively allow client side routing where needed
 * To opt-in: use data-router on any link.
 *
 * Inspired by lit-html router approach,
 * does not rely on rendering, only bubbling click events.
 */
export function Router() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const anchor = (event.target as HTMLElement).closest("a");

      if (!anchor) return;
      const routerAttribute = anchor.getAttribute("data-router");

      if (routerAttribute == null) return;

      event.preventDefault();
      updateLocation(anchor.href, { replace: routerAttribute === "replace" });
    };

    self.addEventListener("click", onClick);

    return () => {
      self.removeEventListener("click", onClick);
    };
  }, [updateLocation]);

  return null;
}

type UseRouterOptions = {
  onLocationUpdated?: (url: URL) => void;
};

/**
 * Hook to push / react to client side routing events.
 *
 * Note: needs <Router> to be attached to work.
 */
export function useRouter({ onLocationUpdated }: UseRouterOptions = {}) {
  useEffect(() => {
    const handler = () => onLocationUpdated?.(new URL(self.location.href));

    self.addEventListener("popstate", handler);
    self.addEventListener("location-changed", handler);

    // Fire on initial load.
    handler();

    return () => {
      self.removeEventListener("popstate", handler);
      self.removeEventListener("location-changed", handler);
    };
  }, [onLocationUpdated]);

  return { updateLocation };
}
