import type { DeveloperCommands } from '@blex/contracts/developer-api';
import type { PageProps } from '@blex/contracts/pages';
import { publicBrand } from '../discovery/discovery-page-data';
import type { AppLocale } from '../../i18n/locale';

/**
 * Everything the browser needs to hydrate the quickstart.
 * It is public in the HTML, so each field is listed by hand.
 */
export interface DeveloperQuickstartData {
    page: 'developer-quickstart';
    locale: AppLocale;
    siteOrigin: string;
    commands: DeveloperCommands;
    brand?: ReturnType<typeof publicBrand>;
    copyrightYear: number;
}

export function createDeveloperQuickstartData({
    brand,
    locale,
    siteOrigin,
    commands
}: PageProps['docs/developer-api/quickstart']): DeveloperQuickstartData {
    return {
        page: 'developer-quickstart',
        locale,
        siteOrigin,
        commands: {
            me: commands.me,
            create: commands.create,
            publish: commands.publish,
            update: commands.update,
            image: commands.image
        },
        brand: publicBrand({ brand }),
        copyrightYear: new Date().getFullYear()
    };
}
