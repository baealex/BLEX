import type { PageProps } from '@blex/contracts/pages';
import { publicBrand } from './discovery-page-data';

/**
 * Everything the browser needs to hydrate a static page.
 * It is public in the HTML, so each field is listed by hand.
 * The page's authored HTML stays out: hydration reads it from the server markup.
 */
export interface StaticPageData {
    page: 'static';
    brand?: ReturnType<typeof publicBrand>;
    copyrightYear: number;
}

/** Error pages show only product copy, so their data names the page and nothing else. */
export interface ErrorPageData {
    page: 'not-found' | 'forbidden';
}

export function createStaticPageData({ meta }: PageProps['static/$slug']): StaticPageData {
    return {
        page: 'static',
        brand: publicBrand(meta),
        copyrightYear: new Date().getFullYear()
    };
}
