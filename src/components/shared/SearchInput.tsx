import { Search, X } from 'lucide-react';
import s from './SearchInput.module.css';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
}

export function SearchInput({ value, onChange, onClear, placeholder = 'Search…', className }: SearchInputProps) {
  return (
    <div className={`${s.wrap} ${className ?? ''}`}>
      <Search size={14} className={s.icon} />
      <input
        type="text"
        className={s.input}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className={s.clear} onClick={() => { onChange(''); onClear?.(); }}>
          <X size={12} />
        </button>
      )}
    </div>
  );
}
