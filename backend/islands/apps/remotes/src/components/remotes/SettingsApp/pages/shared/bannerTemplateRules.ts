import type { BannerImageLayout, BannerTemplate } from '~/lib/api/settings';
import type { BannerPosition, BannerType } from './bannerI18n';

export type TextBannerTemplate = Exclude<BannerTemplate, 'html'>;

/** URL state of the banner editor steps. */
export interface BannerEditorSearch {
    template?: string;
    step?: 'shape' | 'preview';
}

export interface BannerSampleCopy {
    eyebrow: string;
    headline: string;
    description: string;
    linkLabel: string;
    linkUrl: string;
}

interface TemplateFieldVisibility {
    eyebrow: boolean;
    description: boolean;
    linkLabel: boolean;
    image: boolean;
    tone: boolean;
    imageLayout: boolean;
    align: boolean;
}

const BOTH_BANNER_TYPES: BannerType[] = ['horizontal', 'sidebar'];

/** Mirrors the server rule; the server stays the authority and rejects anything else. */
export const TEMPLATE_BANNER_TYPES: Record<TextBannerTemplate, BannerType[]> = {
    notice: BOTH_BANNER_TYPES,
    card: BOTH_BANNER_TYPES,
    callout: ['horizontal'],
    image: BOTH_BANNER_TYPES,
    profile: ['sidebar']
};

const TEMPLATE_DEFAULT_POSITIONS: Record<TextBannerTemplate, BannerPosition> = {
    notice: 'top',
    card: 'bottom',
    callout: 'top',
    image: 'top',
    profile: 'right'
};

export const TEMPLATE_FIELDS: Record<TextBannerTemplate, TemplateFieldVisibility> = {
    notice: {
        eyebrow: true,
        description: false,
        linkLabel: true,
        image: false,
        tone: true,
        imageLayout: false,
        align: false
    },
    card: {
        eyebrow: true,
        description: true,
        linkLabel: true,
        image: true,
        tone: true,
        imageLayout: true,
        align: true
    },
    callout: {
        eyebrow: false,
        description: true,
        linkLabel: true,
        image: false,
        tone: true,
        imageLayout: false,
        align: false
    },
    image: {
        eyebrow: false,
        description: false,
        linkLabel: false,
        image: true,
        tone: false,
        imageLayout: false,
        align: false
    },
    profile: {
        eyebrow: false,
        description: true,
        linkLabel: true,
        image: false,
        tone: true,
        imageLayout: false,
        align: false
    }
};

/** Side-by-side images need the post body width; the sidebar stacks them. */
const IMAGE_LAYOUTS: Record<BannerType, BannerImageLayout[]> = {
    horizontal: ['right', 'left', 'top', 'cover'],
    sidebar: ['top', 'cover']
};

export const BANNER_TITLE_MAX_LENGTH = 100;

/** Width of each real slot on the post page; previews draw banners at this width, then scale them. */
export const BANNER_SLOT_WIDTH: Record<BannerType, number> = {
    horizontal: 760,
    sidebar: 256
};

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

export const imageLayoutsFor = (position: BannerPosition) => IMAGE_LAYOUTS[bannerTypeForPosition(position)];

/** Keep the chosen image layout when the slot allows it, otherwise stack the image on top. */
export const imageLayoutForPosition = (layout: BannerImageLayout, position: BannerPosition): BannerImageLayout => (
    imageLayoutsFor(position).includes(layout) ? layout : 'top'
);

/** A background image sets its own light-on-dark look, so the surface style no longer applies. */
export const isToneAdjustable = (template: BannerTemplate, imageUrl: string, imageLayout: BannerImageLayout) => (
    template !== 'html'
    && TEMPLATE_FIELDS[template].tone
    && !(TEMPLATE_FIELDS[template].imageLayout && imageUrl && imageLayout === 'cover')
);

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
        eyebrow: pick('eyebrow'),
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
