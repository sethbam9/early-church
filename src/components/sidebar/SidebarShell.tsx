import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  expanded: boolean;
  onToggleExpand: () => void;
  onDismiss: () => void;
}

export function SidebarShell({ children, expanded, onToggleExpand, onDismiss }: Props) {
  return (
    <div className={`sidebar-shell${expanded ? " expanded" : ""}`}>
      <div className="sidebar-shell-controls">
        <button
          type="button"
          className="sidebar-ctrl-btn"
          onClick={onToggleExpand}
          title={expanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {expanded ? "⇥" : "⇤"}
        </button>
        <button
          type="button"
          className="sidebar-ctrl-btn sidebar-ctrl-btn--dismiss"
          onClick={onDismiss}
          title="Hide sidebar"
        >
          ✕
        </button>
      </div>
      {children}
    </div>
  );
}
