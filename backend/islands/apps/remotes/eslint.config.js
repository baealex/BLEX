import baejino from '@baejino/eslint-config';
import baejinoReact from '@baejino/eslint-config-react';
import reactCompiler from 'eslint-plugin-react-compiler';

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
        plugins: {
            'react-compiler': reactCompiler
        },
        rules: {
            'indent': 'off',
            'react-compiler/react-compiler': 'error'
        }
    }
];
