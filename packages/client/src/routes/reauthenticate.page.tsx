import { getDocumentLocale } from '../i18n/locale.js';
import { ui } from '../i18n/public-ui.js';
import { SiteFooter, SiteHeader, SiteTheme } from '~/appearance/shell';
import { pageDataScript, renderApplicationDocument } from '~/application/document';
import { authFormPageDataId } from '~/application/route-data';
import { createReauthenticatePageData } from '~/features/auth/ui/form-page-data';
import { ReauthenticatePage } from '~/features/auth/ui/reauthenticate-page';
import type { PageProps } from '@blex/contracts/pages';

export default function renderPage(props: PageProps['reauthenticate']): string {
    const { brand, account, viewer, csrf } = props;
    const data = createReauthenticatePageData(props);
    return renderApplicationDocument(
        <html lang={getDocumentLocale()}>
            <head>
                <meta charSet="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="robots" content="noindex,nofollow,noarchive" />
                <title>{ui('Verify your identity - {value0}', { value0: brand.siteName })}</title>
                <SiteTheme />
            </head>
            <body className="bg-surface-page text-content antialiased">
                <SiteHeader
                    brand={brand}
                    viewer={{
                        username: account.username,
                        hasEditorRole: viewer?.role === 'EDITOR',
                        isStaff: Boolean(viewer?.isStaff),
                        unreadCount: Number(viewer?.unreadCount ?? 0),
                        csrfToken: csrf
                    }}
                />
                <ReauthenticatePage data={data} footer={<SiteFooter brand={brand} />} />
                {pageDataScript(authFormPageDataId, data)}
            </body>
        </html>,
        'tree'
    );
}
