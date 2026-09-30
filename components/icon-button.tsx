import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  label: string;
};

export function IconButton({ icon: Icon, label, className = "", ...props }: Props) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>
      <Icon size={22} strokeWidth={2.2} />
    </button>
  );
}
