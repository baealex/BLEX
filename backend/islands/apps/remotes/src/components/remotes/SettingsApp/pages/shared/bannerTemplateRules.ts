import type { BannerTemplate } from '~/lib/api/settings';
import type { BannerPosition, BannerType } from './bannerI18n';

export type TextBannerTemplate = Exclude<BannerTemplate, 'html'>;

export interface BannerSampleCopy {
    headline: string;
    description: string;
    linkLabel: string;
    linkUrl: string;
}

interface TemplateFieldVisibility {
    description: boolean;
    linkLabel: boolean;
    image: boolean;
    tone: boolean;
}

/** Mirrors the server rule; the server stays the authority and rejects anything else. */
export const TEMPLATE_BANNER_TYPES: Record<TextBannerTemplate, BannerType[]> = {
    notice: ['horizontal'],
    card: ['horizontal'],
    centered: ['horizontal'],
    callout: ['horizontal'],
    image: ['horizontal', 'sidebar'],
    intro: ['sidebar'],
    profile: ['sidebar'],
    sidelink: ['sidebar']
};

const TEMPLATE_DEFAULT_POSITIONS: Record<TextBannerTemplate, BannerPosition> = {
    notice: 'top',
    card: 'bottom',
    centered: 'bottom',
    callout: 'top',
    image: 'top',
    intro: 'right',
    profile: 'right',
    sidelink: 'right'
};

export const TEMPLATE_FIELDS: Record<TextBannerTemplate, TemplateFieldVisibility> = {
    notice: {
        description: false,
        linkLabel: true,
        image: false,
        tone: true
    },
    card: {
        description: true,
        linkLabel: true,
        image: false,
        tone: true
    },
    centered: {
        description: true,
        linkLabel: true,
        image: false,
        tone: true
    },
    callout: {
        description: true,
        linkLabel: true,
        image: false,
        tone: true
    },
    image: {
        description: false,
        linkLabel: false,
        image: true,
        tone: false
    },
    intro: {
        description: true,
        linkLabel: true,
        image: false,
        tone: true
    },
    profile: {
        description: true,
        linkLabel: true,
        image: false,
        tone: true
    },
    sidelink: {
        description: true,
        linkLabel: false,
        image: false,
        tone: true
    }
};

export const BANNER_TITLE_MAX_LENGTH = 100;

export const bannerTypeForPosition = (position: BannerPosition): BannerType => (
    position === 'top' || position === 'bottom' ? 'horizontal' : 'sidebar'
);

export const isTemplateAllowedAt = (template: BannerTemplate, position: BannerPosition) => (
    template === 'html' || TEMPLATE_BANNER_TYPES[template].includes(bannerTypeForPosition(position))
);

export const positionForTemplate = (template: BannerTemplate, position: BannerPosition | null): BannerPosition => {
    if (position && isTemplateAllowedAt(template, position)) {
        return position;
    }

    if (template === 'html') {
        return position ?? 'top';
    }

    return TEMPLATE_DEFAULT_POSITIONS[template];
};

/** Fill empty fields and replace untouched sample text, but never overwrite text the user wrote. */
export const swapSampleCopy = (
    current: BannerSampleCopy,
    previousSample: BannerSampleCopy | null,
    nextSample: BannerSampleCopy
): BannerSampleCopy => {
    const pick = (key: keyof BannerSampleCopy) => {
        const value = current[key];
        const isUntouchedSample = previousSample !== null && value === previousSample[key];
        return !value.trim() || isUntouchedSample ? nextSample[key] : value;
    };

    return {
        headline: pick('headline'),
        description: pick('description'),
        linkLabel: pick('linkLabel'),
        linkUrl: pick('linkUrl')
    };
};

export const isValidBannerLink = (value: string) => {
    if (value.startsWith('/') && !value.startsWith('//')) {
        return true;
    }

    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
};

interface BannerSummarySource {
    title: string;
    template: BannerTemplate;
    contentHtml: string;
    headline: string;
    description: string;
    linkUrl: string;
}

/** Secondary line in banner lists; skips text that already appears as the list title. */
export const bannerListSummary = (banner: BannerSummarySource) => {
    if (banner.template === 'html') {
        return banner.contentHtml;
    }

    if (banner.headline && banner.headline !== banner.title) {
        return banner.headline;
    }

    return banner.description || banner.linkUrl;
};
