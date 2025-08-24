/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{ts,tsx}', '../src/board/templates/**/*.html'],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0f2ff',
                    100: '#e3e7ff',
                    200: '#cdd5ff',
                    300: '#a8b6ff',
                    400: '#7b8cff',
                    500: '#4568dc',
                    600: '#3d53c4',
                    700: '#35459e',
                    800: '#2c3880',
                    900: '#243167'
                },
                secondary: {
                    50: '#faf7fb',
                    100: '#f4eef6',
                    200: '#eadfec',
                    300: '#dac5de',
                    400: '#c59fc9',
                    500: '#b06ab3',
                    600: '#a2519d',
                    700: '#874183',
                    800: '#6e376a',
                    900: '#5c3157'
                }
            }
        }
    },
    plugins: []
};
