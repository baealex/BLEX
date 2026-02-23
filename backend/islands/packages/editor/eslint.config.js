import baejino from '@baejino/eslint-config';
import baejinoReact from '@baejino/eslint-config-react';

export default [
    { ignores: ['dist/**', '*.cjs'] },
    ...baejino,
    ...baejinoReact,
    {
        files: ['**/*.{js,jsx,ts,tsx}'],
        languageOptions: {
            globals: {
                browser: true,
                es6: true,
                node: true
            }
        },
        rules: {
            'indent': 'off',
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@blex/ui',
                            message: 'Use component subpath imports (e.g. @blex/ui/dropdown).'
                        }
                    ]
                }
            ]
        }
    }
];
