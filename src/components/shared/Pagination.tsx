export const PAGE_SIZE = 30;

interface PaginationProps {
  page: number;
  total: number;
  pageSize?: number;
  onChange: (p: number) => void;
}

export function Pagination({ page, total, pageSize = PAGE_SIZE, onChange }: PaginationProps) {
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return (
    <div className="pagination">
      <button
        type="button"
        className="pagination-btn"
        disabled={page === 0}
        onClick={() => onChange(page - 1)}
      >◀</button>
      <span>{page + 1} / {pages}</span>
      <button
        type="button"
        className="pagination-btn"
        disabled={page >= pages - 1}
        onClick={() => onChange(page + 1)}
      >▶</button>
    </div>
  );
}
