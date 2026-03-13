import { useState, useRef, useEffect } from 'react';
import s from './Dropdown.module.css';

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function DropdownSelect({ options, value, onChange, className }: DropdownSelectProps) {
  return (
    <select className={`${s.select} ${className ?? ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

interface DropdownMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
}

export function DropdownMenu({ open, onClose, anchorRef, children, className }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setAbove(rect.top > window.innerHeight / 2);
  }, [open, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={menuRef} className={`${s.menu} ${above ? s.above : ''} ${className ?? ''}`}>
      {children}
    </div>
  );
}

export function DropdownItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button type="button" className={s.item} onMouseDown={onClick}>{children}</button>;
}
