import s from './EntityLink.module.css';
import { EntityHoverWrap } from './EntityHoverCard';
import { getEntityLabel } from '../../data/dataStore';
import { kindIcon } from './entityConstants';

interface EntityLinkProps {
  kind: string;
  id: string;
  label?: string;
  showIcon?: boolean;
  onClick?: () => void;
  className?: string;
}

export function EntityLink({ kind, id, label, showIcon, onClick, className }: EntityLinkProps) {
  const display = label || getEntityLabel(kind, id);
  return (
    <EntityHoverWrap kind={kind} id={id}>
      <button type="button" className={`${s.link} ${className ?? ''}`} onClick={onClick}>
        {showIcon && <>{kindIcon(kind)} </>}{display}
      </button>
    </EntityHoverWrap>
  );
}
