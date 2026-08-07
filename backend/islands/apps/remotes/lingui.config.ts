import { defineConfig } from '@lingui/cli';
import { SUPPORTED_LOCALES } from './src/i18n/locale';

export default defineConfig({
    sourceLocale: 'en',
    locales: [...SUPPORTED_LOCALES, 'pseudo'],
    catalogs: [
        {
            path: '<rootDir>/src/locales/{locale}/messages',
            include: ['<rootDir>/src']
        }
    ],
    compileNamespace: 'es',
    orderBy: 'messageId',
    pseudoLocale: {
        locale: 'pseudo',
        prepend: '⟦ ',
        append: ' ⟧',
        extend: 0.35
    }
});
