import type { ReactNode } from 'react';
import { LoginForm } from './login-form.js';
import { type LoginPageData, readLoginPageData } from './login-page-data';
import { serverFooter } from './server-footer';
import './login.css';

/** The server passes its site footer; the browser passes the copy it reads back from the server markup. */
export function LoginPage({ data, footer }: { data: LoginPageData; footer: ReactNode }) {
    return (
        <>
            <LoginForm model={data} />
            {footer}
        </>
    );
}

export function mountPage(value: unknown, content: Element) {
    const data = readLoginPageData(value);
    if (!data) throw new Error('The sign-in form data is invalid, so the form stays as server HTML.');
    return <LoginPage data={data} footer={serverFooter(content)} />;
}
