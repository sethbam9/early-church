import { useAppStore } from "../../stores/appStore";

interface MapToolbarProps {
  onFitVisible: () => void;
  onCenterSelected: () => void;
  onRandomSite: () => void;
  hasSelection: boolean;
  hasVisible: boolean;
}

export function MapToolbar({
  onFitVisible,
  onCenterSelected,
  onRandomSite,
  hasSelection,
  hasVisible,
}: MapToolbarProps) {
  const setSelection = useAppStore((s) => s.setSelection);
  const shareStatus = useAppStore((s) => s.shareStatus);
  const setShareStatus = useAppStore((s) => s.setShareStatus);
  const toggleShortcutHelp = useAppStore((s) => s.toggleShortcutHelp);
  const showShortcutHelp = useAppStore((s) => s.showShortcutHelp);
  const toggleArchaeologyLayer = useAppStore((s) => s.toggleArchaeologyLayer);
  const toggleCorrespondenceLayer = useAppStore((s) => s.toggleCorrespondenceLayer);
  const archaeologyLayerVisible = useAppStore((s) => s.archaeologyLayerVisible);
  const correspondenceLayerVisible = useAppStore((s) => s.correspondenceLayerVisible);

  async function copyShareUrl() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus("Link copied");
      setTimeout(() => setShareStatus(""), 1800);
    } catch {
      setShareStatus("Copy failed");
    }
  }

  return (
    <section className="control-card">
      <div className="control-card-top">
        <h2>Map actions</h2>
      </div>
      <div className="action-grid">
        <button type="button" onClick={onFitVisible}>Fit visible</button>
        <button type="button" onClick={onCenterSelected} disabled={!hasSelection}>Center selected</button>
        <button type="button" onClick={onRandomSite} disabled={!hasVisible}>Random site</button>
        <button type="button" onClick={() => setSelection(null)} disabled={!hasSelection}>Clear details</button>
        <button type="button" onClick={copyShareUrl}>Copy share URL</button>
        <button type="button" onClick={toggleShortcutHelp}>
          {showShortcutHelp ? "Hide" : "Show"} shortcuts
        </button>
      </div>
      <div className="action-grid" style={{ marginTop: 7 }}>
        <button type="button" onClick={toggleArchaeologyLayer}>
          {archaeologyLayerVisible ? "Hide" : "Show"} archaeology
        </button>
        <button type="button" onClick={toggleCorrespondenceLayer}>
          {correspondenceLayerVisible ? "Hide" : "Show"} arcs
        </button>
      </div>
      {shareStatus ? <p className="muted small">{shareStatus}</p> : null}
    </section>
  );
}
