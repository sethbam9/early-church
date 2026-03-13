import s from './Badge.module.css';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger'
  | 'supports' | 'opposes' | 'contextualizes' | 'mentions';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  title?: string;
}

export function Badge({ children, variant = 'neutral', className, title }: BadgeProps) {
  return (
    <span className={`${s.badge} ${s[variant] ?? s.neutral} ${className ?? ''}`} title={title}>
      {children}
    </span>
  );
}
