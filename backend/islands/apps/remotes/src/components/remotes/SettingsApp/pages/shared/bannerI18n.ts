import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { BannerTemplate } from '~/lib/api/settings';
import type { TextBannerTemplate } from './bannerTemplateRules';

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
    intro: msg({
        id: 'settings.banners.template.intro',
        message: 'Introduction card'
    }),
    html: msg({
        id: 'settings.banners.template.html',
        message: 'Custom HTML'
    })
};

export const bannerTemplateDescriptions: Record<BannerTemplate, MessageDescriptor> = {
    notice: msg({
        id: 'settings.banners.template.notice.description',
        message: 'A short message and a link.'
    }),
    card: msg({
        id: 'settings.banners.template.card.description',
        message: 'A title, a description, and a button.'
    }),
    intro: msg({
        id: 'settings.banners.template.intro.description',
        message: 'An introduction for the sidebar.'
    }),
    html: msg({
        id: 'settings.banners.template.html.description',
        message: 'Write your own markup.'
    })
};

export const bannerTemplateSamples: Record<TextBannerTemplate, {
    headline: MessageDescriptor;
    description?: MessageDescriptor;
    linkLabel: MessageDescriptor;
}> = {
    notice: {
        headline: msg({
            id: 'settings.banners.sample.notice.headline',
            message: 'A new series has started.'
        }),
        linkLabel: msg({
            id: 'settings.banners.sample.notice.link_label',
            message: 'Take a look'
        })
    },
    card: {
        headline: msg({
            id: 'settings.banners.sample.card.headline',
            message: 'Did this post help you?'
        }),
        description: msg({
            id: 'settings.banners.sample.card.description',
            message: 'Subscribe to get new posts first.'
        }),
        linkLabel: msg({
            id: 'settings.banners.sample.card.link_label',
            message: 'Subscribe'
        })
    },
    intro: {
        headline: msg({
            id: 'settings.banners.sample.intro.headline',
            message: 'Hi, I write this blog.'
        }),
        description: msg({
            id: 'settings.banners.sample.intro.description',
            message: 'I write down what I learn while building things.'
        }),
        linkLabel: msg({
            id: 'settings.banners.sample.intro.link_label',
            message: 'About me'
        })
    }
};
