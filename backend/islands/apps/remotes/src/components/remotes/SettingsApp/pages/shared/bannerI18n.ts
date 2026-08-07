import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';

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
