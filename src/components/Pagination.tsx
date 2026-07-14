interface Props {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

const MAX_TMDB_PAGE = 500;

export default function Pagination({ page, totalPages, buildHref }: Props) {
  const clampedTotal = Math.min(totalPages, MAX_TMDB_PAGE);
  if (clampedTotal <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < clampedTotal;

  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4 text-sm">
      {hasPrev ? (
        <a
          href={buildHref(page - 1)}
          className="flex min-h-11 items-center rounded-full border border-white/10 px-4 py-2 text-white/80"
        >
          ← Précédent
        </a>
      ) : (
        <span className="flex min-h-11 items-center rounded-full border border-white/5 px-4 py-2 text-white/30">
          ← Précédent
        </span>
      )}
      <span className="text-white/60">
        Page {page} / {clampedTotal}
      </span>
      {hasNext ? (
        <a
          href={buildHref(page + 1)}
          className="flex min-h-11 items-center rounded-full border border-white/10 px-4 py-2 text-white/80"
        >
          Suivant →
        </a>
      ) : (
        <span className="flex min-h-11 items-center rounded-full border border-white/5 px-4 py-2 text-white/30">
          Suivant →
        </span>
      )}
    </nav>
  );
}
