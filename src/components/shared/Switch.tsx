import s from "./Switch.module.css";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Switch({ checked, onChange, label, className }: SwitchProps) {
  return (
    <label className={`${s.wrap} ${className ?? ""}`} onClick={(e) => { e.preventDefault(); onChange(!checked); }}>
      <span className={`${s.track}${checked ? ` ${s.trackOn}` : ""}`}>
        <span className={`${s.thumb}${checked ? ` ${s.thumbOn}` : ""}`} />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
