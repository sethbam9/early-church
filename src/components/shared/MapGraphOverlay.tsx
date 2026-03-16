/**
 * Shared zoom / center / fit overlay for Map and Graph center areas.
 * Renders a vertical stack of small buttons in the top-left corner.
 */
import type { ReactNode } from "react";
import { Plus, Minus, Maximize2, Crosshair } from "lucide-react";
import s from "./MapGraphOverlay.module.css";

interface MapGraphOverlayProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitVisible?: () => void;
  onCenterSelected?: () => void;
  fitLabel?: ReactNode;
  centerLabel?: ReactNode;
  showCenter?: boolean;
}

export function MapGraphOverlay({
  onZoomIn,
  onZoomOut,
  onFitVisible,
  onCenterSelected,
  fitLabel,
  centerLabel,
  showCenter = false,
}: MapGraphOverlayProps) {
  return (
    <div className={s.overlay}>
      {onZoomIn && (
        <button type="button" className={s.btn} onClick={onZoomIn} title="Zoom in"><Plus size={14} /></button>
      )}
      {onZoomOut && (
        <button type="button" className={`${s.btn} ${s.btnMinus}`} onClick={onZoomOut} title="Zoom out"><Minus size={14} /></button>
      )}
      {onFitVisible && (
        <button type="button" className={s.btn} onClick={onFitVisible} title="Fit visible">{fitLabel ?? <Maximize2 size={14} />}</button>
      )}
      {showCenter && onCenterSelected && (
        <button type="button" className={s.btn} onClick={onCenterSelected} title="Center on selected">{centerLabel ?? <Crosshair size={14} />}</button>
      )}
    </div>
  );
}
