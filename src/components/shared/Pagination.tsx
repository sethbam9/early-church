import { ChevronLeft, ChevronRight } from "lucide-react";
import s from "./Pagination.module.css";

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
    <div className={s.pagination}>
      <button type="button" className={s.btn} disabled={page === 0} onClick={() => onChange(page - 1)}><ChevronLeft size={13} /></button>
      <span>{page + 1} / {pages}</span>
      <button type="button" className={s.btn} disabled={page >= pages - 1} onClick={() => onChange(page + 1)}><ChevronRight size={13} /></button>
    </div>
  );
}
