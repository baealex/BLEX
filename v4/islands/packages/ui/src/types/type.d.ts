import type Alpine from 'alpinejs';
import 'react';

declare module 'react' {
    interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
        jsx?: boolean;
        global?: boolean;
    }
}

declare module '*.scss' {
    const content: { [className: string]: string };
    export default content;
}

declare global {
    interface Window {
        Alpine: Alpine;
        configuration: {
            media: string;
            static: string;
            user?: {
                isAuthenticated: boolean;
                username: string;
            };
            googleClientId?: string;
            githubClientId?: string;
        };
        NEXT_URL: string;
    }
}
