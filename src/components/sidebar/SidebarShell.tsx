import { type ReactNode, useRef, useEffect, useState, useCallback } from "react";

interface Props {
  children: ReactNode;
  onDismiss: () => void;
}

const MIN_WIDTH = 260;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 340;
const SNAP_CLOSE_WIDTH = 180;

export function SidebarShell({ children, onDismiss }: Props) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [closing, setClosing] = useState(false);
  const dragRef = useRef({ active: false, startX: 0, startW: DEFAULT_WIDTH });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { active: true, startX: e.clientX, startW: width };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = dragRef.current.startX - e.clientX;
    const next = Math.min(MAX_WIDTH, Math.max(100, dragRef.current.startW + dx));
    setWidth(next);
    setClosing(next < SNAP_CLOSE_WIDTH);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    const dx = dragRef.current.startX - e.clientX;
    const finalW = dragRef.current.startW + dx;
    if (finalW < SNAP_CLOSE_WIDTH) {
      onDismiss();
      setWidth(DEFAULT_WIDTH);
      setClosing(false);
    } else {
      setWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, finalW)));
      setClosing(false);
    }
  }, [onDismiss]);

  return (
    <div
      className={`sidebar-shell${closing ? " sidebar-shell--closing" : ""}`}
      style={{ width }}
    >
      <div
        className="sidebar-drag-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />
      {children}
    </div>
  );
}
