/** @type {import('tailwindcss').Config} */
export default {
    content: ['./src/**/*.{ts,tsx}', '../src/board/templates/**/*.html'],
    theme: {
        extend: {
            // 미니멀 흑/백/회색 시스템 - Tailwind 기본 zinc 색상 사용
            // CSS 변수(variables.css)와 정렬된 색상 팔레트
        }
    },
    plugins: []
};
