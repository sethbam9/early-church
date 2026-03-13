/**
 * Cross-page navigation icons.
 * Renders icon buttons to open the current entity on Map, Graph, or Wiki pages.
 * Excludes the icon for the page you're already on.
 */
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores/appStore";
import type { Selection } from "../../data/dataStore";
import cs from "./CrossPageNav.module.css";

type PageKey = "map" | "graph" | "wiki";

const PAGE_ICONS: Record<PageKey, { icon: string; label: string; path: string }> = {
  map:   { icon: "🗺️", label: "View in Map",   path: "/"      },
  graph: { icon: "🕸️", label: "View in Graph", path: "/graph" },
  wiki:  { icon: "📖", label: "View in Wiki",  path: "/wiki"  },
};

export function CrossPageNav({ kind, id, current }: { kind: string; id: string; current: PageKey }) {
  const navigate = useNavigate();
  const others = (Object.keys(PAGE_ICONS) as PageKey[]).filter((k) => k !== current);

  function handleNav(key: PageKey) {
    const p = PAGE_ICONS[key];
    if (key === "map") {
      // Map reads selection from appStore, not URL params
      useAppStore.getState().setSelection({ kind, id } as Selection);
      navigate(p.path);
    } else {
      navigate(`${p.path}?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
    }
  }

  return (
    <span className={cs.nav}>
      {others.map((key) => {
        const p = PAGE_ICONS[key];
        return (
          <button key={key} type="button" className={cs.icon} title={p.label} onClick={() => handleNav(key)}>
            {p.icon}
          </button>
        );
      })}
    </span>
  );
}
