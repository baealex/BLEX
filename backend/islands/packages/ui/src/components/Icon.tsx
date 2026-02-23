import type { LucideIcon } from 'lucide-react';
import { cx } from '../lib/classnames';

const sizeMap = {
    xs: 14,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32
} as const;

const sizeClassMap = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
    xl: 'w-8 h-8'
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
            className={cx(sizeClassMap[size], 'shrink-0', className)}
            width={px}
            height={px}
        />
    );
};

export { Icon };
export type { IconProps, IconSize };
