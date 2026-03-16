import { useNavigate } from "react-router-dom";
import s from "./InfoIcon.module.css";

interface InfoIconProps {
  claimId: string;
  title?: string;
}

export function InfoIcon({ claimId, title = "Open claim in audit page" }: InfoIconProps) {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/audit?claimId=${encodeURIComponent(claimId)}`);
  };

  return (
    <button
      type="button"
      className={s.iconBtn}
      onClick={handleClick}
      title={title}
    >
      ⓘ
    </button>
  );
}
