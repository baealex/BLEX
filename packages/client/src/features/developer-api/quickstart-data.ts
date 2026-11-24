import type { DeveloperCommands } from '@blex/contracts/developer-api';
import type { PageProps } from '@blex/contracts/pages';
import { publicBrand } from '../discovery/discovery-page-data';

/**
 * Everything the browser needs to hydrate the quickstart.
 * It is public in the HTML, so each field is listed by hand.
 */
export interface DeveloperQuickstartData {
    page: 'developer-quickstart';
    siteOrigin: string;
    commands: DeveloperCommands;
    brand?: ReturnType<typeof publicBrand>;
    copyrightYear: number;
}

export function createDeveloperQuickstartData({
    brand,
    siteOrigin,
    commands
}: PageProps['docs/developer-api/quickstart']): DeveloperQuickstartData {
    return {
        page: 'developer-quickstart',
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
