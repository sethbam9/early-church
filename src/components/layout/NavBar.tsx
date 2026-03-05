import { NavLink } from "react-router-dom";

export function NavBar() {
  return (
    <nav className="nav-bar">
      <div className="nav-logo">
        Early Christianity Atlas
        <span className="nav-logo-sub">AD 33 – 800</span>
      </div>

      <div className="nav-spacer" />
      <NavLink to="/graph" className={({ isActive }) => `nav-btn${isActive ? " active" : ""}`}>
        ✦ Graph
      </NavLink>
    </nav>
  );
}
