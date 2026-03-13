import { useState } from 'react';
import s from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  expandContent?: React.ReactNode;
  onClick?: () => void;
  flush?: boolean;
  className?: string;
}

export function Card({ children, icon, title, subtitle, actions, expandContent, onClick, flush, className }: CardProps) {
  const [expanded, setExpanded] = useState(false);

  const cls = [s.card, onClick ? s.clickable : '', flush ? s.flush : '', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      {(icon || title || subtitle || actions || expandContent) && (
        <div className={s.header} onClick={onClick}>
          {icon && <span className={s.icon}>{icon}</span>}
          <div className={s.body}>
            {title && <div className={s.title}>{title}</div>}
            {subtitle && <div className={s.subtitle}>{subtitle}</div>}
          </div>
          <div className={s.actions}>
            {actions}
            {expandContent && (
              <button type="button" className={s.expandBtn}
                onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
                title={expanded ? 'Collapse' : 'Expand'}>
                {expanded ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>
      )}
      {children}
      {expanded && expandContent && (
        <div className={s.expandContent}>{expandContent}</div>
      )}
    </div>
  );
}
