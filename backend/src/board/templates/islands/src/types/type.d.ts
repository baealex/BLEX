import 'react';

declare module 'react' {
    interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
        jsx?: boolean;
        global?: boolean;
    }
}

declare global {
    const ISLAND: {
        HOST_URL: string;
        STATIC_URL: string;
    };
    export const ISLAND;
}

declare module '*.scss' {
    const content: { [className: string]: string };
    export default content;
}
