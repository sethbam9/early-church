/**
 * CertaintyBadge — replaces raw certainty text ("probable", "possible", "uncertain")
 * with a compact colored icon + hover tooltip.
 * "attested" is the default/norm and renders nothing.
 */
import s from "./CertaintyBadge.module.css";
import { CERTAINTY_COLORS } from "./entityConstants";

const CERTAINTY_ICONS: Record<string, string> = {
  probable:  "◐",
  possible:  "○",
  uncertain: "△",
};

const CERTAINTY_TIPS: Record<string, string> = {
  probable:  "Probable — likely but not fully attested",
  possible:  "Possible — plausible but uncertain",
  uncertain: "Uncertain — disputed or weakly evidenced",
  attested:  "Attested — well-established",
};

interface CertaintyBadgeProps {
  value: string;
  className?: string;
}

export function CertaintyBadge({ value, className }: CertaintyBadgeProps) {
  if (!value || value === "attested") return null;
  const icon = CERTAINTY_ICONS[value] ?? "?";
  const color = CERTAINTY_COLORS[value] ?? "var(--text-muted)";
  const tip = CERTAINTY_TIPS[value] ?? value;
  return (
    <span
      className={`${s.badge} ${className ?? ""}`}
      style={{ color }}
      title={tip}
      aria-label={tip}
    >
      {icon}
    </span>
  );
}
