import { NavLink } from "react-router-dom";

export function NavBar() {
  return (
    <nav className="nav-bar">
      <div className="nav-logo">
        Early Christianity Atlas
        <span className="nav-logo-sub">AD 33 – 800</span>
      </div>

      <div className="nav-spacer" />
      <NavLink to="/" end className={({ isActive }) => `nav-btn${isActive ? " active" : ""}`}>
        🗺 Map
      </NavLink>
      <NavLink to="/graph" className={({ isActive }) => `nav-btn${isActive ? " active" : ""}`}>
        🕸️ Graph
      </NavLink>
      <NavLink to="/wiki" className={({ isActive }) => `nav-btn${isActive ? " active" : ""}`}>
        📖 Wiki
      </NavLink>
    </nav>
  );
}
