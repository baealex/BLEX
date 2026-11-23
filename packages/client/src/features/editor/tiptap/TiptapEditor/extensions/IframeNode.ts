import { Node, ReactNodeViewRenderer } from '@tiptap/react';
import { IframeNodeView } from '../components/nodeviews/IframeNodeView';

export const IframeNode = Node.create({
    name: 'iframe',

    group: 'block',

    atom: true,

    addNodeView() {
        return ReactNodeViewRenderer(IframeNodeView);
    },

    addAttributes() {
        return {
            src: { default: null },
            width: { default: '100%' },
            height: { default: null },
            frameborder: { default: '0' },
            allowfullscreen: { default: true },
            align: { default: 'center' }, // left, center, right
            aspectRatio: { default: '16:9' }, // 16:9, 4:3, 21:9, 1:1
            caption: { default: null }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'figure',
                getAttrs: (element) => {
                    const figure = element as HTMLElement;
                    const iframe = figure.querySelector('iframe');
                    const caption = figure.querySelector('figcaption');

                    if (!iframe) return false;

                    return {
                        src: iframe.src || null,
                        width: iframe.width || '100%',
                        height: iframe.height || null,
                        frameborder: iframe.getAttribute('frameborder') || '0',
                        allowfullscreen: iframe.hasAttribute('allowfullscreen'),
                        align: figure.style.textAlign || figure.getAttribute('data-align') || 'center',
                        aspectRatio: iframe.getAttribute('data-aspect-ratio') || '16:9',
                        caption: caption?.textContent || null
                    };
                }
            },
            {
                tag: 'iframe',
                getAttrs: (element) => {
                    const iframe = element as HTMLIFrameElement;
                    return {
                        src: iframe.src || null,
                        width: iframe.width || '100%',
                        height: iframe.height || null,
                        frameborder: iframe.getAttribute('frameborder') || '0',
                        allowfullscreen: iframe.hasAttribute('allowfullscreen'),
                        align: 'center',
                        aspectRatio: iframe.getAttribute('data-aspect-ratio') || '16:9',
                        caption: null
                    };
                }
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const { src, height, frameborder, align, aspectRatio, caption } = HTMLAttributes;

        const iframeAttrs: Record<string, string> = {
            frameborder: frameborder || '0',
            allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
            allowfullscreen: ''
        };

        if (src) iframeAttrs.src = src;

        const iframeStyles: string[] = ['width: 100%', 'border: 0'];
        if (aspectRatio) {
            iframeStyles.push(`aspect-ratio: ${aspectRatio.replace(':', ' / ')}`);
            iframeAttrs['data-aspect-ratio'] = aspectRatio;
        } else if (height) {
            iframeStyles.push(`height: ${height}px`);
        } else {
            iframeStyles.push('height: 350px');
        }
        iframeAttrs.style = iframeStyles.join('; ');

        const figureStyles: string[] = ['width: 100%', 'margin: 0'];
        const figureAttrs: Record<string, string> = {};

        if (align) {
            figureStyles.push(`text-align: ${align}`);
            if (align === 'center') {
                figureStyles.push(
                    'display: flex',
                    'justify-content: center',
                    'flex-direction: column',
                    'align-items: center'
                );
            } else if (align === 'left') {
                figureStyles.push(
                    'display: flex',
                    'justify-content: flex-start',
                    'flex-direction: column',
                    'align-items: flex-start'
                );
            } else if (align === 'right') {
                figureStyles.push(
                    'display: flex',
                    'justify-content: flex-end',
                    'flex-direction: column',
                    'align-items: flex-end'
                );
            }
        }

        figureAttrs.style = figureStyles.join('; ');

        const content: Array<[string, Record<string, string>, ...unknown[]]> = [['iframe', iframeAttrs]];

        if (caption) {
            content.push(['figcaption', {}, caption]);
        }

        return ['figure', figureAttrs, ...content];
    }
});
