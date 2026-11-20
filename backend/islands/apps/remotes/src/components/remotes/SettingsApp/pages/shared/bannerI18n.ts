import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { BannerTemplate } from '~/lib/api/settings';

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
        message: 'One-line notice'
    }),
    card: msg({
        id: 'settings.banners.template.card',
        message: 'Call-to-action card'
    }),
    centered: msg({
        id: 'settings.banners.template.centered',
        message: 'Centered card'
    }),
    callout: msg({
        id: 'settings.banners.template.callout',
        message: 'Callout'
    }),
    image: msg({
        id: 'settings.banners.template.image',
        message: 'Image banner'
    }),
    intro: msg({
        id: 'settings.banners.template.intro',
        message: 'Introduction card'
    }),
    profile: msg({
        id: 'settings.banners.template.profile',
        message: 'Profile card'
    }),
    sidelink: msg({
        id: 'settings.banners.template.sidelink',
        message: 'Side link'
    }),
    html: msg({
        id: 'settings.banners.template.html',
        message: 'Custom HTML'
    })
};
