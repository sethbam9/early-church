import { useEffect, useRef } from "react";
import s from "./Timeline.module.css";

export interface TimelineRow {
  decade: number;
  dotColor: string;
  content: React.ReactNode;
}

interface TimelineProps {
  rows: TimelineRow[];
  activeDecade: number;
  emptyMessage?: string;
}

export function Timeline({ rows, activeDecade, emptyMessage = "No timeline data." }: TimelineProps) {
  const activeRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeDecade]);

  if (rows.length === 0) return <div className={s.empty}>{emptyMessage}</div>;

  return (
    <div className={s.list}>
      {rows.map((row, idx) => {
        const isActive = row.decade === activeDecade;
        const isLast = idx === rows.length - 1;
        return (
          <div
            key={row.decade}
            ref={isActive ? activeRowRef : null}
            className={`${s.row}${isActive ? ` ${s.rowActive}` : ""}`}
          >
            <div className={`${s.gutter}${isLast ? ` ${s.gutterLast}` : ""}`}>
              <span
                className={`${s.dot}${isActive ? ` ${s.dotActive}` : ""}`}
                style={{
                  borderColor: row.dotColor,
                  background: isActive ? row.dotColor : "transparent",
                  boxShadow: isActive ? `0 0 0 4px ${row.dotColor}22` : undefined,
                }}
              />
            </div>
            <div className={s.content}>
              {row.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
