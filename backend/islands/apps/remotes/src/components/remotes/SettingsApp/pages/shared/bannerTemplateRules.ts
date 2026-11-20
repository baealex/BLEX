import type { BannerTemplate } from '~/lib/api/settings';
import type { BannerPosition, BannerType } from './bannerI18n';

export type TextBannerTemplate = Exclude<BannerTemplate, 'html'>;

export interface BannerSampleCopy {
    headline: string;
    description: string;
    linkLabel: string;
}

export const TEMPLATE_BANNER_TYPES: Record<TextBannerTemplate, BannerType> = {
    notice: 'horizontal',
    card: 'horizontal',
    intro: 'sidebar'
};

const TEMPLATE_DEFAULT_POSITIONS: Record<TextBannerTemplate, BannerPosition> = {
    notice: 'top',
    card: 'bottom',
    intro: 'right'
};

export const BANNER_TITLE_MAX_LENGTH = 100;

export const bannerTypeForPosition = (position: BannerPosition): BannerType => (
    position === 'top' || position === 'bottom' ? 'horizontal' : 'sidebar'
);

export const isTemplateAllowedAt = (template: BannerTemplate, position: BannerPosition) => (
    template === 'html' || TEMPLATE_BANNER_TYPES[template] === bannerTypeForPosition(position)
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
        linkLabel: pick('linkLabel')
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
