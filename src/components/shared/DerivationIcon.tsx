import { useNavigate } from "react-router-dom";
import { GitBranch } from "lucide-react";
import s from "./InfoIcon.module.css";

interface DerivationIconProps {
  edgeId: string;
  title?: string;
}

/**
 * Small icon button that navigates to the audit page showing the derivation chain
 * for a derived edge. Reuses InfoIcon styling but with GitBranch icon.
 */
export function DerivationIcon({ edgeId, title = "View derivation trail" }: DerivationIconProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/audit?edgeId=${encodeURIComponent(edgeId)}`);
  };

  return (
    <button
      type="button"
      className={s.iconBtn}
      onClick={handleClick}
      title={title}
    >
      <GitBranch size={12} />
    </button>
  );
}
