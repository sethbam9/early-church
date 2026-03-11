import { useLocation } from "react-router-dom";
import { NavBar } from "./components/layout/NavBar";
import { MapPage } from "./pages/MapPage";
import { GraphPage } from "./pages/GraphPage";
import { WikiPage } from "./pages/WikiPage";

export function App() {
  const { pathname } = useLocation();
  const page = pathname === "/graph" ? "graph" : pathname === "/wiki" ? "wiki" : "map";

  return (
    <div className="app-root">
      <NavBar />
      <div className="page-container">
        <div style={{ display: page === "map"   ? "contents" : "none" }}><MapPage /></div>
        <div style={{ display: page === "graph" ? "contents" : "none" }}><GraphPage /></div>
        <div style={{ display: page === "wiki"  ? "contents" : "none" }}><WikiPage /></div>
      </div>
    </div>
  );
}
