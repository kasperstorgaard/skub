import { clsx } from "clsx/lite";

import { CaretLeft, CaretRight, Icon } from "#/components/icons.tsx";

type Props = {
  page: number;
  totalPages: number;
  baseUrl: string;
  className?: string;
};

export function Pagination({ page, totalPages, baseUrl, className }: Props) {
  const hasPrevious = page > 1;
  const hasNext = page < totalPages;

  const getPageUrl = (page: number) => {
    const url = new URL(baseUrl);
    if (page === 1) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", page.toString());
    }
    return url.pathname + url.search;
  };

  return (
    <nav
      className={clsx(
        "flex items-center justify-center gap-fl-2 self-end uppercase",
        "max-lg:w-full",
        className,
      )}
      aria-label="Pagination"
    >
      <a
        href={hasPrevious ? getPageUrl(page - 1) : "#"}
        className="icon-btn"
        data-size="sm"
        aria-disabled={!hasPrevious ? true : undefined}
        aria-label="Previous page"
      >
        <Icon icon={CaretLeft} />
      </a>

      <span className="text-4 text-text-2">
        {page} / {totalPages}
      </span>

      <a
        href={hasNext ? getPageUrl(page + 1) : "#"}
        className="icon-btn"
        data-size="sm"
        aria-disabled={!hasNext ? true : undefined}
        aria-label="Next page"
      >
        <Icon icon={CaretRight} />
      </a>
    </nav>
  );
}
