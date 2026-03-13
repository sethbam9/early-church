import s from './ToggleGroup.module.css';

interface ToggleGroupProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function ToggleGroup<T extends string>({ options, value, onChange, className }: ToggleGroupProps<T>) {
  return (
    <div className={`${s.group} ${className ?? ''}`}>
      {options.map((opt) => (
        <button key={opt.value} type="button"
          className={`${s.option} ${value === opt.value ? s.active : ''}`}
          onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
