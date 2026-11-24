import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { SiteHeader, SiteTheme, type SiteHeaderProps } from '../appearance/shell.js';
import { ApplicationFrame } from './frame.js';

type Element = ReactElement<{ children?: ReactNode }>;

export function scriptJson(value: unknown): string {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

/** The data a `tree` page hydrates from. Body scripts stay direct children of `<body>`, where the client reads them. */
export function pageDataScript(id: string, data: unknown): ReactElement {
    return <script key="data" type="application/json" id={id} dangerouslySetInnerHTML={{ __html: scriptJson(data) }} />;
}

/**
 * How the browser takes over a page's content:
 * `static` keeps it as server markup, and `tree` hydrates all of it inside the application root.
 */
export type ContentMode = 'static' | 'tree';

// A page supplies its React head, header and content once, for direct visits and router loads.
export function renderApplicationDocument(page: ReactElement, mode: ContentMode = 'static'): string {
    const siblings = Children.toArray((page as Element).props.children);
    const head = siblings.find((node): node is Element => isValidElement(node) && node.type === 'head');
    const body = siblings.find((node): node is Element => isValidElement(node) && node.type === 'body');
    if (page.type !== 'html' || !head || !body) throw new Error('An application page requires an HTML document.');

    let header: SiteHeaderProps | null = null;
    const content: ReactNode[] = [];
    const scripts: ReactNode[] = [];
    for (const node of Children.toArray(body.props.children)) {
        if (isValidElement<SiteHeaderProps>(node) && node.type === SiteHeader) header = clientHeader(node.props);
        else if (isValidElement(node) && node.type === 'script') scripts.push(node);
        else content.push(node);
    }

    const view =
        mode === 'tree'
            ? {
                  header,
                  html: '',
                  content: <>{content}</>
              }
            : {
                  header,
                  html: renderToStaticMarkup(<>{content}</>)
              };
    const headContent = Children.toArray(head.props.children);
    if (!headContent.some((node) => isValidElement(node) && node.type === SiteTheme))
        headContent.unshift(<SiteTheme key="site-theme" />);
    const nextHead = cloneElement(
        head,
        {},
        ...headContent,
        <meta name="blex-application" content="1" />,
        <script type="module" src="/assets/blex/app.js" data-blex-app-entry="" />
    );
    const nextBody = cloneElement(
        body,
        {},
        <div id="blex-application" className="contents" data-header={JSON.stringify(header)}>
            <ApplicationFrame view={view} />
        </div>,
        ...scripts
    );
    return '<!doctype html>' + renderToString(cloneElement(page, {}, nextHead, nextBody));
}

function clientHeader({ brand, viewer, searchPage, editorPage, hideAuthLinks }: SiteHeaderProps): SiteHeaderProps {
    return {
        brand: brand && {
            siteName: brand.siteName,
            logoUrl: brand.logoUrl,
            darkLogoUrl: brand.darkLogoUrl
        },
        viewer: viewer && {
            username: viewer.username,
            hasEditorRole: viewer.hasEditorRole,
            isStaff: viewer.isStaff,
            csrfToken: viewer.csrfToken,
            unreadCount: viewer.unreadCount
        },
        searchPage,
        editorPage,
        hideAuthLinks
    };
}
