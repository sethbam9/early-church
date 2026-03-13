import s from './Tabs.module.css';

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  vertical?: boolean;
  compact?: boolean;
  className?: string;
}

export function Tabs({ tabs, active, onChange, vertical, compact, className }: TabsProps) {
  const cls = [
    s.tabs,
    vertical ? s.vertical : '',
    compact ? s.compact : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {tabs.map((t) => (
        <button key={t.id} type="button"
          className={`${s.tab} ${active === t.id ? s.active : ''}`}
          onClick={() => onChange(t.id)}
          title={t.label}>
          {t.icon && <span className={s.icon}>{t.icon}</span>}
          <span className={s.label}>{t.label}</span>
        </button>
      ))}
    </div>
  );
}
