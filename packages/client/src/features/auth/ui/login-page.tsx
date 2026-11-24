import type { ReactNode } from 'react';
import { LoginForm } from './login-form.js';
import { type LoginPageData, readLoginPageData } from './login-page-data';
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
    // The footer carries the site brand, which stays out of the page data.
    const footer = content.querySelector(':scope > footer');
    if (!footer) throw new Error('The sign-in page footer is missing from the page.');
    return (
        <LoginPage
            data={data}
            footer={<footer className={footer.className} dangerouslySetInnerHTML={{ __html: footer.innerHTML }} />}
        />
    );
}
