import { NavLink } from "react-router-dom";
import s from "./NavBar.module.css";

export function NavBar() {
  return (
    <nav className={s.bar}>
      <div className={s.logo}>
        Early Christianity Atlas
        <span className={s.logoSub}>AD 33 – 800</span>
      </div>

      <div className={s.spacer} />
      <NavLink to="/" end className={({ isActive }) => `${s.link}${isActive ? ` ${s.active}` : ""}`}>
        🗺 Map
      </NavLink>
      <NavLink to="/graph" className={({ isActive }) => `${s.link}${isActive ? ` ${s.active}` : ""}`}>
        🕸️ Graph
      </NavLink>
      <NavLink to="/wiki" className={({ isActive }) => `${s.link}${isActive ? ` ${s.active}` : ""}`}>
        📖 Wiki
      </NavLink>
    </nav>
  );
}
