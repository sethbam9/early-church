import s from './ExternalLink.module.css';

interface ExternalLinkProps {
  href: string;
  children: React.ReactNode;
  title?: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export function ExternalLink({ href, children, title, className, onClick }: ExternalLinkProps) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`${s.link} ${className ?? ''}`} title={title} onClick={onClick}>
      {children}<span className={s.arrow}>↗</span>
    </a>
  );
}
