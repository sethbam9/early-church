import s from './PanelSection.module.css';

interface PanelSectionProps {
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
}

export function PanelSection({ title, action, children, className }: PanelSectionProps) {
  return (
    <div className={`${s.section} ${className ?? ''}`}>
      <div className={s.header}>
        <span className={s.title}>{title}</span>
        {action && (
          <button type="button" className={s.action} onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}
