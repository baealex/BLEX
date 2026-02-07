import type { LucideIcon } from 'lucide-react';
import { cx } from '../lib/classnames';

const sizeMap = {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32
} as const;

type IconSize = keyof typeof sizeMap;

interface IconProps {
    icon: LucideIcon;
    size?: IconSize;
    className?: string;
}

const Icon = ({ icon: LucideIcon, size = 'md', className }: IconProps) => {
    const px = sizeMap[size];

    return (
        <LucideIcon
            className={cx(`w-[${px}px] h-[${px}px] shrink-0`, className)}
            width={px}
            height={px}
        />
    );
};

export default Icon;
export type { IconProps, IconSize };
