/**
 * Shared zoom / center / fit overlay for Map and Graph center areas.
 * Renders a vertical stack of small buttons in the top-left corner.
 */
import s from "./MapGraphOverlay.module.css";

interface MapGraphOverlayProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitVisible?: () => void;
  onCenterSelected?: () => void;
  fitLabel?: string;
  centerLabel?: string;
  showCenter?: boolean;
}

export function MapGraphOverlay({
  onZoomIn,
  onZoomOut,
  onFitVisible,
  onCenterSelected,
  fitLabel = "fit",
  centerLabel = "center",
  showCenter = false,
}: MapGraphOverlayProps) {
  return (
    <div className={s.overlay}>
      {onZoomIn && (
        <button type="button" className={s.btn} onClick={onZoomIn} title="Zoom in">+</button>
      )}
      {onZoomOut && (
        <button type="button" className={`${s.btn} ${s.btnMinus}`} onClick={onZoomOut} title="Zoom out">−</button>
      )}
      {onFitVisible && (
        <button type="button" className={s.btnSmall} onClick={onFitVisible} title="Fit visible">{fitLabel}</button>
      )}
      {showCenter && onCenterSelected && (
        <button type="button" className={s.btnSmall} onClick={onCenterSelected} title="Center on selected">{centerLabel}</button>
      )}
    </div>
  );
}
