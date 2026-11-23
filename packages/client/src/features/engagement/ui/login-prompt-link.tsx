import type { ComponentPropsWithoutRef } from 'react';
import { type LoginPromptAction, loginPromptProps } from './login-prompt';

type LoginPromptLinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
    returnTo: string;
    action: LoginPromptAction;
};

export function LoginPromptLink({ returnTo, action, children, ...props }: LoginPromptLinkProps) {
    const { href, ...prompt } = loginPromptProps(returnTo, action);
    return (
        <a {...props} {...prompt} href={href}>
            {children}
        </a>
    );
}
