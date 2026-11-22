import type { ComponentProps } from 'react';
import type { TablerIcon } from '@tabler/icons-react';
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
    icon: TablerIcon;
    size?: IconSize;
    className?: string;
}

const Icon = ({ icon: Glyph, size = 'md', className }: IconProps) => {
    const px = sizeMap[size];

    return (
        <Glyph
            className={cx(sizeClassMap[size], 'shrink-0', className)}
            width={px}
            height={px}
        />
    );
};

type InlineIconProps = Omit<ComponentProps<TablerIcon>, 'size'> & { icon: TablerIcon };

/** Follows the surrounding font size, so `text-*` classes size it. */
const InlineIcon = ({ icon: Glyph, className, ...props }: InlineIconProps) => (
    <Glyph
        aria-hidden="true"
        {...props}
        size="1em"
        className={cx('inline-block shrink-0 align-[-0.125em]', className)}
    />
);

export { Icon, InlineIcon };
export type { IconProps, IconSize, InlineIconProps };
