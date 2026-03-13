import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import s from './TooltipOverlay.module.css';

interface TooltipOverlayProps {
  anchorEl: HTMLElement;
  children: React.ReactNode;
  className?: string;
}

export function TooltipOverlay({ anchorEl, children, className }: TooltipOverlayProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const rect = anchorEl.getBoundingClientRect();
    const tooltipW = 280;
    const tooltipH = 180;
    let top = rect.bottom + 4;
    let left = rect.left;
    if (top + tooltipH > window.innerHeight) top = rect.top - tooltipH - 4;
    if (left + tooltipW > window.innerWidth) left = window.innerWidth - tooltipW - 8;
    if (left < 4) left = 4;
    setPos({ top, left });
  }, [anchorEl]);

  if (!pos) return null;

  return createPortal(
    <div className={`${s.tooltip} ${className ?? ''}`} style={{ top: pos.top, left: pos.left }}>
      {children}
    </div>,
    document.body,
  );
}

export { s as tooltipStyles };
