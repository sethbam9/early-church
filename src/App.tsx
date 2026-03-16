import { useLocation } from "react-router-dom";
import { NavBar } from "./components/layout/NavBar";
import { MapPage } from "./pages/MapPage";
import { GraphPage } from "./pages/GraphPage";
import { WikiPage } from "./pages/WikiPage";
import { AuditPage } from "./pages/AuditPage";
import { GuidePage } from "./pages/GuidePage";
import s from "./App.module.css";

export function App() {
  const { pathname } = useLocation();
  const page = pathname === "/graph" ? "graph" : pathname === "/wiki" ? "wiki" : pathname === "/audit" ? "audit" : pathname === "/guide" ? "guide" : "map";

  return (
    <div className={s.root}>
      <NavBar />
      <div className={s.pages}>
        <div style={{ display: page === "map"   ? "contents" : "none" }}><MapPage /></div>
        <div style={{ display: page === "graph" ? "contents" : "none" }}><GraphPage /></div>
        <div style={{ display: page === "wiki"  ? "contents" : "none" }}><WikiPage /></div>
        <div style={{ display: page === "audit" ? "contents" : "none" }}><AuditPage /></div>
        <div style={{ display: page === "guide" ? "contents" : "none" }}><GuidePage /></div>
      </div>
    </div>
  );
}
