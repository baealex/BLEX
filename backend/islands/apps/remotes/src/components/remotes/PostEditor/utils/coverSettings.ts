import type { CoverImageRatio, CoverLayout } from '../types';
import { i18n } from '~/i18n';

export const getCoverLayoutOptions = (): Array<{
    value: CoverLayout;
    label: string;
    description: string;
}> => [
    {
        value: 'default',
        label: i18n._({
            id: 'editor.cover.layout.default',
            message: 'Default'
        }),
        description: i18n._({
            id: 'editor.cover.layout.default_description',
            message: 'The image follows naturally after the title.'
        })
    },
    {
        value: 'split',
        label: i18n._({
            id: 'editor.cover.layout.split',
            message: 'Split'
        }),
        description: i18n._({
            id: 'editor.cover.layout.split_description',
            message: 'Place the title and cover image side by side.'
        })
    },
    {
        value: 'overlay',
        label: i18n._({
            id: 'editor.cover.layout.overlay',
            message: 'Image background'
        }),
        description: i18n._({
            id: 'editor.cover.layout.overlay_description',
            message: 'Use a full-width image with the title over it.'
        })
    },
    {
        value: 'none',
        label: i18n._({
            id: 'editor.cover.layout.hidden',
            message: 'Hide cover'
        }),
        description: i18n._({
            id: 'editor.cover.layout.hidden_description',
            message: 'Use the cover image only in listings and shares, not at the top of the post.'
        })
    }
];

export const getCoverRatioItems = () => [
    {
        value: 'auto',
        label: i18n._({
            id: 'editor.cover.ratio.original',
            message: 'Original ratio'
        })
    },
    {
        value: '16:9',
        label: i18n._({
            id: 'editor.cover.ratio.wide',
            message: '16:9 wide'
        })
    },
    {
        value: '4:3',
        label: i18n._({
            id: 'editor.cover.ratio.standard',
            message: '4:3 standard'
        })
    },
    {
        value: '1:1',
        label: i18n._({
            id: 'editor.cover.ratio.square',
            message: '1:1 square'
        })
    },
    {
        value: '3:4',
        label: i18n._({
            id: 'editor.cover.ratio.portrait',
            message: '3:4 portrait'
        })
    }
];

export const getCoverPositionItems = () => [
    {
        value: 'right',
        label: i18n._({
            id: 'editor.cover.position.right',
            message: 'Image on the right'
        })
    },
    {
        value: 'left',
        label: i18n._({
            id: 'editor.cover.position.left',
            message: 'Image on the left'
        })
    }
];

export const getCoverRatioClass = (ratio: CoverImageRatio | string) => {
    switch (ratio) {
        case '1:1':
            return 'aspect-square';
        case '4:3':
            return 'aspect-[4/3]';
        case '3:4':
            return 'aspect-[3/4]';
        default:
            return 'aspect-[16/9]';
    }
};

export const supportsCoverImagePosition = (layout: CoverLayout | string) => layout === 'split';

export const supportsCoverImageRatio = (layout: CoverLayout | string) => (
    layout === 'default' || layout === 'split'
);
