import baejino from '@baejino/eslint-config';
import baejinoReact from '@baejino/eslint-config-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
    { ignores: ['dist/**', '*.cjs'] },
    ...baejino,
    ...baejinoReact.map((config) => ({
        ...config,
        plugins: { ...config.plugins, 'react-hooks': reactHooks },
        rules: {
            ...config.rules,
            ...reactHooks.configs.recommended.rules,
            // Report newly enabled compiler diagnostics while existing components migrate.
            'react-hooks/immutability': 'warn',
            'react-hooks/purity': 'warn',
            'react-hooks/refs': 'warn',
            'react-hooks/set-state-in-effect': 'warn',
            'react-hooks/static-components': 'warn'
        }
    })),
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
                            message: 'Use component subpath imports (e.g. @blex/ui/button).'
                        },
                        {
                            name: '@blex/editor',
                            message: 'Use explicit subpath imports (e.g. @blex/editor/tiptap-editor, @blex/editor/languages).'
                        }
                    ]
                }
            ]
        }
    },
    {
        files: [
            'src/island.tsx',
            'src/components/App.tsx'
        ],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    paths: [
                        {
                            name: '@blex/ui',
                            message: 'Use component subpath imports (e.g. @blex/ui/button).'
                        },
                        {
                            name: '@blex/editor',
                            message: 'Use explicit subpath imports only inside lazy-loaded feature modules.'
                        }
                    ],
                    patterns: [
                        {
                            group: [
                                '@blex/editor',
                                '@blex/editor/*',
                                '@tanstack/react-router',
                                '@tanstack/router-core',
                                '@tiptap/*',
                                'prosemirror*',
                                '@monaco-editor/react',
                                'frappe-charts',
                                'zod',
                                'zod/*'
                            ],
                            message: 'Bootstrap code must not statically import feature-heavy dependencies. Move this behind a dynamic import boundary.'
                        }
                    ]
                }
            ]
        }
    }
];
