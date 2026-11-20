import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type {
    BannerAlign,
    BannerImageLayout,
    BannerTemplate,
    BannerTone
} from '~/lib/api/settings';

export type BannerType = 'horizontal' | 'sidebar';
export type BannerPosition = 'top' | 'bottom' | 'left' | 'right';

export const bannerPositionOptions: BannerPosition[] = [
    'top',
    'bottom',
    'left',
    'right'
];

export const bannerTypeMessages: Record<BannerType, MessageDescriptor> = {
    horizontal: msg({
        id: 'settings.banners.type.horizontal',
        message: 'Horizontal banner'
    }),
    sidebar: msg({
        id: 'settings.banners.type.sidebar',
        message: 'Sidebar banner'
    })
};

export const bannerPositionMessages: Record<BannerPosition, MessageDescriptor> = {
    top: msg({
        id: 'settings.banners.position.top',
        message: 'Top'
    }),
    bottom: msg({
        id: 'settings.banners.position.bottom',
        message: 'Bottom'
    }),
    left: msg({
        id: 'settings.banners.position.left',
        message: 'Left'
    }),
    right: msg({
        id: 'settings.banners.position.right',
        message: 'Right'
    })
};

export const bannerTemplateMessages: Record<BannerTemplate, MessageDescriptor> = {
    notice: msg({
        id: 'settings.banners.template.notice',
        message: 'Announcement bar'
    }),
    card: msg({
        id: 'settings.banners.template.card',
        message: 'Card'
    }),
    callout: msg({
        id: 'settings.banners.template.callout',
        message: 'Callout'
    }),
    image: msg({
        id: 'settings.banners.template.image',
        message: 'Image banner'
    }),
    profile: msg({
        id: 'settings.banners.template.profile',
        message: 'Profile card'
    }),
    html: msg({
        id: 'settings.banners.template.html',
        message: 'Custom HTML'
    })
};

export const bannerToneMessages: Record<BannerTone, MessageDescriptor> = {
    default: msg({
        id: 'settings.banners.editor.tone.default',
        message: 'Default'
    }),
    outline: msg({
        id: 'settings.banners.editor.tone.outline',
        message: 'Outline'
    }),
    emphasis: msg({
        id: 'settings.banners.editor.tone.emphasis',
        message: 'Emphasis'
    })
};

export const bannerImageLayoutMessages: Record<BannerImageLayout, MessageDescriptor> = {
    right: msg({
        id: 'settings.banners.editor.image_layout.right',
        message: 'Right'
    }),
    left: msg({
        id: 'settings.banners.editor.image_layout.left',
        message: 'Left'
    }),
    top: msg({
        id: 'settings.banners.editor.image_layout.top',
        message: 'Top'
    }),
    cover: msg({
        id: 'settings.banners.editor.image_layout.cover',
        message: 'Background'
    })
};

export const bannerAlignMessages: Record<BannerAlign, MessageDescriptor> = {
    left: msg({
        id: 'settings.banners.editor.align.left',
        message: 'Left'
    }),
    center: msg({
        id: 'settings.banners.editor.align.center',
        message: 'Center'
    })
};
