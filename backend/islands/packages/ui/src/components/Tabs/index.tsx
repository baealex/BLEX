import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';
import { cx } from '../../lib/classnames';

interface TabsRootProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    children: ReactNode;
    className?: string;
}

const Root = ({ children, className, ...props }: TabsRootProps) => (
    <RadixTabs.Root className={className} {...props}>
        {children}
    </RadixTabs.Root>
);

interface TabsListProps {
    children: ReactNode;
    className?: string;
}

const List = ({ children, className }: TabsListProps) => (
    <RadixTabs.List
        className={cx(
            'flex border-b border-line',
            className
        )}>
        {children}
    </RadixTabs.List>
);

interface TabsTriggerProps {
    value: string;
    children: ReactNode;
    className?: string;
}

const Trigger = ({ value, children, className }: TabsTriggerProps) => (
    <RadixTabs.Trigger
        value={value}
        className={cx(
            'px-4 py-2.5 text-sm font-medium text-content-secondary transition-colors',
            'hover:text-content',
            'data-[state=active]:text-content data-[state=active]:border-b-2 data-[state=active]:border-action data-[state=active]:-mb-px',
            'focus:outline-none',
            className
        )}>
        {children}
    </RadixTabs.Trigger>
);

interface TabsContentProps {
    value: string;
    children: ReactNode;
    className?: string;
}

const Content = ({ value, children, className }: TabsContentProps) => (
    <RadixTabs.Content
        value={value}
        className={cx(
            'focus:outline-none',
            'data-[state=active]:animate-in data-[state=active]:fade-in-0',
            className
        )}>
        {children}
    </RadixTabs.Content>
);

export const Tabs = {
    Root,
    List,
    Trigger,
    Content
};
