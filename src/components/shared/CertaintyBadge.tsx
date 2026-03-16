/**
 * CertaintyBadge — replaces raw certainty text ("probable", "possible", "uncertain")
 * with a compact colored icon + hover tooltip.
 * "attested" is the default/norm and renders nothing.
 */
import { CircleDashed, CircleDot, AlertCircle } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import s from "./CertaintyBadge.module.css";
import { CERTAINTY_COLORS } from "./entityConstants";

const CERTAINTY_ICON_COMPONENTS: Record<string, ComponentType<LucideProps>> = {
  probable:  CircleDot,
  possible:  CircleDashed,
  uncertain: AlertCircle,
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
  const IconComponent = CERTAINTY_ICON_COMPONENTS[value];
  const color = CERTAINTY_COLORS[value] ?? "var(--text-muted)";
  const tip = CERTAINTY_TIPS[value] ?? value;
  return (
    <span
      className={`${s.badge} ${className ?? ""}`}
      style={{ color }}
      title={tip}
      aria-label={tip}
    >
      {IconComponent ? <IconComponent size={12} strokeWidth={2} /> : "?"}
    </span>
  );
}
