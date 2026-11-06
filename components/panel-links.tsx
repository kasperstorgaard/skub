import { clsx } from "clsx/lite";

import { GithubLogo, Icon, LinkedinLogo } from "#/components/icons.tsx";

type PanelLinksProps = {
  className?: string;
};

/**
 * Mobile only: the GitHub and LinkedIn links at the foot of a `Panel`.
 * Desktop shows them in the sidebar's own footer.
 */
export function PanelLinks({ className }: PanelLinksProps) {
  return (
    <div className={clsx("lg:hidden flex gap-2 text-2", className)}>
      <a
        href="https://github.com/kasperstorgaard/ricochet"
        className="flex gap-1 text-text-2"
      >
        <Icon icon={GithubLogo} />GitHub
      </a>
      <a
        href="https://www.linkedin.com/in/kasper-storgaard-t-lead"
        className="flex gap-1 text-text-2"
      >
        <Icon icon={LinkedinLogo} />LinkedIn
      </a>
    </div>
  );
}
