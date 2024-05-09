import dynamic from 'next/dynamic';

export const EditorContent = dynamic(() => import('./EditorContent'), {
    ssr: false
});
