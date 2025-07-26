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
