import s from './Chip.module.css';

type ChipVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
  | 'attested' | 'probable' | 'claimed' | 'suppressed' | 'unknown';

const ACTIVE_MAP: Record<string, string> = {
  accent:     s.active || '',
  success:    s.activeSuccess || '',
  warning:    s.activeWarning || '',
  danger:     s.activeDanger || '',
  attested:   s.activeAttested || '',
  probable:   s.activeProbable || '',
  claimed:    s.activeClaimed || '',
  suppressed: s.activeSuppressed || '',
  unknown:    s.activeUnknown || '',
};

interface ChipProps {
  children: React.ReactNode;
  variant?: ChipVariant;
  active?: boolean;
  activeClassName?: string;
  dot?: string;
  preserveDotOnActive?: boolean;
  legend?: boolean;
  onClick?: () => void;
  className?: string;
  title?: string;
}

export function Chip({ children, variant = 'neutral', active, activeClassName, dot, preserveDotOnActive, legend, onClick, className, title }: ChipProps) {
  const cls = [
    s.chip,
    onClick ? s.clickable : '',
    active ? (ACTIVE_MAP[variant] || s.active) : '',
    active ? (activeClassName ?? '') : '',
    preserveDotOnActive ? s.preserveDotOnActive : '',
    legend ? s.legend : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag type={onClick ? 'button' : undefined} className={cls} onClick={onClick} title={title}>
      {dot && <span className={s.dot} style={{ background: dot, ['--chip-dot-color' as string]: dot }} />}
      {children}
    </Tag>
  );
}
