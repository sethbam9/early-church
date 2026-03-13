import s from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'close';
  size?: 'sm' | 'md';
}

export function Button({ variant = 'ghost', size = 'md', className, children, ...rest }: ButtonProps) {
  const cls = [s.btn, s[variant], s[size], className ?? ''].filter(Boolean).join(' ');
  return <button type="button" className={cls} {...rest}>{children}</button>;
}
