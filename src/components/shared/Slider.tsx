import s from './Slider.module.css';

interface SliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
  className?: string;
}

export function Slider({ min, max, value, onChange, minLabel, maxLabel, className }: SliderProps) {
  return (
    <div className={`${s.wrap} ${className ?? ''}`}>
      {(minLabel || maxLabel) && (
        <div className={s.rangeRow}>
          <span>{minLabel ?? min}</span>
          <span>{maxLabel ?? max}</span>
        </div>
      )}
      <input
        type="range"
        className={s.input}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
