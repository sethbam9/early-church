import { Chip } from "./Chip";
import s from "./FilterChips.module.css";

interface FilterChipsProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  active: T | null;
  onChange: (value: T | null) => void;
}

export function FilterChips<T extends string>({ label, options, active, onChange }: FilterChipsProps<T>) {
  if (options.length === 0) return null;

  return (
    <div className={s.bar}>
      <div className={s.header}>
        <span className={s.label}>{label}</span>
        {active && (
          <button type="button" className={s.clearBtn} onClick={() => onChange(null)}>clear</button>
        )}
      </div>
      <div className={s.chips}>
        {options.map((opt) => (
          <Chip key={opt.value} active={active === opt.value}
            onClick={() => onChange(active === opt.value ? null : opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}
