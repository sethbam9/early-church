import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { MapNavIcon, GraphNavIcon, WikiNavIcon, AuditNavIcon, GuideNavIcon } from "../shared/icons";
import { GlobalSearchOverlay } from "../shared/GlobalSearchOverlay";
import { DropdownSelect } from "../shared/Dropdown";
import { useAppStore } from "../../stores/appStore";
import type { SelectionKind } from "../../data/types";
import { Moon, Sun } from "lucide-react";
import { ShareButton } from "../shared/ShareButton";
import brandIcon from "/android-chrome-192x192.png";
import s from "./NavBar.module.css";

const PAGE_OPTIONS = [
  { value: "wiki", label: "Wiki" },
  { value: "map", label: "Map" },
  { value: "graph", label: "Graph" },
];

export function NavBar() {
  const [searchTarget, setSearchTarget] = useState("wiki");
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const navigate = useNavigate();
  const setSelection = useAppStore((st) => st.setSelection);
  const setSearchQuery = useAppStore((st) => st.setSearchQuery);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "");
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const handleSearchSelect = (kind: string, id: string) => {
    if (searchTarget === "map") {
      setSelection({ kind: kind as SelectionKind, id });
      navigate("/");
    } else if (searchTarget === "wiki") {
      navigate(`/wiki?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
    } else if (searchTarget === "graph") {
      navigate(`/graph?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
    }
  };

  return (
    <nav className={s.bar}>
      <div className={s.branding}>
        <img src={brandIcon} alt="" className={s.brandIcon} />
        <div className={s.logo}>
          Early Christianity Atlas
          <span className={s.logoSub}>AD 33 – 800</span>
        </div>
      </div>

      <div className={s.searchContainer}>
        <GlobalSearchOverlay
          onSelect={handleSearchSelect}
          onQueryChange={setSearchQuery}
          placeholder="Search all entities… (press / to focus)"
          className={s.navSearch}
          enableSlashShortcut
        />
        <DropdownSelect
          options={PAGE_OPTIONS}
          value={searchTarget}
          onChange={setSearchTarget}
        />
      </div>

      <div className={s.spacer} />
      <NavLink to="/" end className={({ isActive }) => `${s.link}${isActive ? ` ${s.active}` : ""}`}>
        <MapNavIcon size={16} />
        <span>Map</span>
      </NavLink>
      <NavLink to="/graph" className={({ isActive }) => `${s.link}${isActive ? ` ${s.active}` : ""}`}>
        <GraphNavIcon size={16} />
        <span>Graph</span>
      </NavLink>
      <NavLink to="/wiki" className={({ isActive }) => `${s.link}${isActive ? ` ${s.active}` : ""}`}>
        <WikiNavIcon size={16} />
        <span>Wiki</span>
      </NavLink>
      <NavLink to="/audit" className={({ isActive }) => `${s.link}${isActive ? ` ${s.active}` : ""}`}>
        <AuditNavIcon size={16} />
        <span>Audit</span>
      </NavLink>
      <NavLink to="/guide" className={({ isActive }) => `${s.link}${isActive ? ` ${s.active}` : ""}`}>
        <GuideNavIcon size={16} />
        <span>Guide</span>
      </NavLink>
      <ShareButton />
      <button type="button" className={s.themeToggle} onClick={() => setDark((v) => !v)} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </nav>
  );
}
