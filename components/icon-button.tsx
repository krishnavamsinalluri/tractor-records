import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ComponentType<{ size?: number; className?: string; color?: string }>;
  children?: ReactNode;
  label: string;
};

export function IconButton({ icon: Icon, label, className = "", children, ...props }: Props) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
}
