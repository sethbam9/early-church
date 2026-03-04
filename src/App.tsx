import { Routes, Route, Navigate } from "react-router-dom";
import { NavBar } from "./components/layout/NavBar";
import { MapPage } from "./pages/MapPage";
import { GraphPage } from "./pages/GraphPage";

export function App() {
  return (
    <div className="app-root">
      <NavBar />
      <div className="page-container">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
