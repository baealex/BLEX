import type { CSSProperties } from 'react';

/**
 * 사이즈 프리셋 → px 매핑
 * px 기반이라 모바일에서는 컨테이너 폭을 초과하지 않아 자연스럽게 꽉 참
 */
export const SIZE_PRESETS: Record<string, number> = {
    small: 320,
    medium: 480,
    large: 640
};

/**
 * figure 컨테이너 스타일 (이미지/비디오 공용)
 */
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

    // 내부 정렬 (이미지/비디오가 figure 안에서 정렬)
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

    // 사이즈 프리셋 + figure 자체의 위치 정렬 (margin 기반)
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

    // 장식 속성 (기존 콘텐츠 호환용)
    if (attrs.border) {
        style.border = '1px solid #e5e7eb';
        style.overflow = 'hidden';
    }
    if (attrs.shadow) {
        style.boxShadow = '8px 8px 40px 2px rgba(0, 0, 0, 0.15)';
    }
    if (attrs.borderRadius) {
        style.borderRadius = `${attrs.borderRadius}px`;
        style.overflow = 'hidden';
    }

    return style;
}

/**
 * 미디어 요소(img/video) 스타일 (공용)
 */
export function getMediaStyle(attrs: {
    objectFit?: string;
    aspectRatio?: string | null;
    width?: number | null;
    height?: number | null;
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

    return style;
}

/**
 * renderHTML용 figure 스타일 문자열 + 어트리뷰트 생성 (공용)
 */
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
            styles.push('display: flex', 'justify-content: flex-start', 'flex-direction: column', 'align-items: flex-start');
        } else if (attrs.align === 'right') {
            styles.push('display: flex', 'justify-content: flex-end', 'flex-direction: column', 'align-items: flex-end');
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

    if (attrs.border) {
        styles.push('border: 1px solid #e5e7eb', 'overflow: hidden');
        result['data-border'] = 'true';
    }
    if (attrs.shadow) {
        styles.push('box-shadow: 8px 8px 40px 2px rgba(0, 0, 0, 0.15)');
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
