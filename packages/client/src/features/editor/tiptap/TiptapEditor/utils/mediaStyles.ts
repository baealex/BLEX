import type { CSSProperties } from 'react';

export const FULL_WIDTH_SIZE_PRESET = 'full';

/** Maximum preset widths in pixels; full-width media follows the container. */
export const SIZE_PRESETS: Record<string, number> = {
    small: 320,
    medium: 480,
    large: 640
};

const MEDIA_BORDER_STYLE = '1px solid var(--color-line-strong, #d2d2d7)';
const MEDIA_SHADOW_STYLE = '8px 8px 40px 2px var(--color-shadow-lg, rgba(0, 0, 0, 0.15))';

export function getFigureStyle(attrs: {
    align?: string;
    border?: boolean;
    shadow?: boolean;
    borderRadius?: number | string | null;
    sizePreset?: string | null;
}): CSSProperties {
    const style: CSSProperties = {
        margin: 0,
        display: 'flex',
        flexDirection: 'column'
    };

    switch (attrs.align) {
        case 'left':
            style.alignItems = 'flex-start';
            break;
        case 'right':
            style.alignItems = 'flex-end';
            break;
        case 'center':
        default:
            style.alignItems = 'center';
            break;
    }

    if (attrs.sizePreset && SIZE_PRESETS[attrs.sizePreset]) {
        style.maxWidth = SIZE_PRESETS[attrs.sizePreset];

        if (attrs.align === 'center') {
            style.marginLeft = 'auto';
            style.marginRight = 'auto';
        } else if (attrs.align === 'right') {
            style.marginLeft = 'auto';
            style.marginRight = 0;
        }
    }

    if (attrs.sizePreset === FULL_WIDTH_SIZE_PRESET) {
        style.width = '100%';
        style.maxWidth = '100%';
    }

    if (attrs.border) {
        style.border = MEDIA_BORDER_STYLE;
        style.overflow = 'hidden';
    }
    if (attrs.shadow) {
        style.boxShadow = MEDIA_SHADOW_STYLE;
    }
    if (attrs.borderRadius) {
        style.borderRadius = `${attrs.borderRadius}px`;
        style.overflow = 'hidden';
    }

    return style;
}

export function getMediaStyle(attrs: {
    objectFit?: string;
    aspectRatio?: string | null;
    width?: number | null;
    height?: number | null;
    sizePreset?: string | null;
}): CSSProperties {
    const style: CSSProperties = {
        display: 'block',
        maxWidth: '100%'
    };

    if (attrs.objectFit) {
        style.objectFit = attrs.objectFit as CSSProperties['objectFit'];
    }
    if (attrs.aspectRatio) {
        style.aspectRatio = attrs.aspectRatio.replace(':', ' / ');
        if (!attrs.width && !attrs.height) {
            style.width = '100%';
        }
    }
    if (attrs.width) style.width = `${attrs.width}px`;
    if (attrs.height) style.height = `${attrs.height}px`;
    if (attrs.sizePreset === FULL_WIDTH_SIZE_PRESET) {
        style.width = '100%';
        if (!attrs.height) {
            style.height = 'auto';
        }
    }

    return style;
}

export function buildFigureAttrsForHTML(attrs: {
    align?: string;
    border?: boolean;
    shadow?: boolean;
    borderRadius?: number | string | null;
    sizePreset?: string | null;
}): { styles: string[]; attrs: Record<string, string> } {
    const styles: string[] = [];
    const result: Record<string, string> = {};

    if (attrs.align) {
        styles.push(`text-align: ${attrs.align}`);
        if (attrs.align === 'center') {
            styles.push('display: flex', 'justify-content: center', 'flex-direction: column', 'align-items: center');
        } else if (attrs.align === 'left') {
            styles.push(
                'display: flex',
                'justify-content: flex-start',
                'flex-direction: column',
                'align-items: flex-start'
            );
        } else if (attrs.align === 'right') {
            styles.push(
                'display: flex',
                'justify-content: flex-end',
                'flex-direction: column',
                'align-items: flex-end'
            );
        }
    }

    if (attrs.sizePreset && SIZE_PRESETS[attrs.sizePreset]) {
        styles.push(`max-width: ${SIZE_PRESETS[attrs.sizePreset]}px`);
        result['data-size'] = attrs.sizePreset;

        if (attrs.align === 'center') {
            styles.push('margin-left: auto', 'margin-right: auto');
        } else if (attrs.align === 'right') {
            styles.push('margin-left: auto', 'margin-right: 0');
        }
    }

    if (attrs.sizePreset === FULL_WIDTH_SIZE_PRESET) {
        styles.push('width: 100%', 'max-width: 100%');
        result['data-size'] = FULL_WIDTH_SIZE_PRESET;
    }

    if (attrs.border) {
        styles.push(`border: ${MEDIA_BORDER_STYLE}`, 'overflow: hidden');
        result['data-border'] = 'true';
    }
    if (attrs.shadow) {
        styles.push(`box-shadow: ${MEDIA_SHADOW_STYLE}`);
        result['data-shadow'] = 'true';
    }
    if (attrs.borderRadius) {
        styles.push(`border-radius: ${attrs.borderRadius}px`, 'overflow: hidden');
        result['data-border-radius'] = String(attrs.borderRadius);
    }

    if (styles.length > 0) {
        result.style = styles.join('; ');
    }

    return {
        styles,
        attrs: result
    };
}
