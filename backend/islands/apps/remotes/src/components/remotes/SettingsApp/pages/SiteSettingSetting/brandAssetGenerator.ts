import type { BrandAssetTheme, BrandAssetType } from '~/lib/api/settings';

export const ICON_PNG_SIZES = [16, 32, 57, 72, 76, 96, 114, 120, 128, 144, 152, 192, 256, 512] as const;

const SVG_MIME_TYPE = 'image/svg+xml';
const ICO_MIME_TYPE = 'image/x-icon';
const SVG_MAX_NODES = 300;
const PROCESSING_INSTRUCTION_PATTERN = /<\?(?!xml\s)[\s\S]*?\?>/i;
const DOCTYPE_PATTERN = /<!DOCTYPE/i;
const SVG_ALLOWED_TAGS = new Set([
    'svg', 'g', 'defs', 'title', 'desc',
    'style',
    'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
    'linearGradient', 'radialGradient', 'stop',
    'text', 'tspan'
]);
const SVG_ALLOWED_ATTRIBUTES = new Set([
    'xmlns', 'viewBox', 'width', 'height', 'class', 'style', 'type', 'fill', 'stroke', 'stroke-width',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
    'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'fill-opacity',
    'stroke-opacity', 'd', 'points', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
    'cx', 'cy', 'r', 'rx', 'ry', 'transform', 'gradientUnits',
    'gradientTransform', 'offset', 'stop-color', 'stop-opacity', 'id',
    'role', 'aria-hidden', 'focusable', 'xml:space', 'font-family',
    'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
    'letter-spacing', 'fill-rule', 'clip-rule', 'version',
    'preserveAspectRatio'
]);
const DANGEROUS_VALUE_PATTERN = /(javascript:|https?:|\/\/|data:|@import)/i;
const EXTERNAL_URL_PATTERN = /url\(\s*(?!#|'#|"#)/i;
const ALLOWED_NAMESPACE_VALUES = new Set([
    'http://www.w3.org/2000/svg',
    'http://www.w3.org/1999/xlink'
]);

interface SvgViewBox {
    minX: number;
    minY: number;
    width: number;
    height: number;
}

interface GeneratedPng {
    size: number;
    blob: Blob;
}

export const createSvgBrandAssetFormData = (
    assetType: BrandAssetType,
    theme: BrandAssetTheme,
    svgFile: File
) => {
    const formData = new FormData();
    formData.append('asset_type', assetType);
    formData.append('theme', theme);
    formData.append('svg', svgFile, svgFile.name || `${assetType}.svg`);
    return formData;
};

export const createIconBrandAssetFormData = async (svgFile: File) => {
    const svgText = await svgFile.text();
    const normalizedSvgText = normalizeSvgForRendering(svgText);
    const pngFiles = await generatePngFiles(normalizedSvgText);
    const faviconIco = await createIcoBlob(pngFiles.filter((item) => item.size === 16 || item.size === 32));

    const formData = createSvgBrandAssetFormData('icon', 'default', svgFile);
    formData.append('manifest', JSON.stringify({
        version: 1,
        pngSizes: [...ICON_PNG_SIZES],
        ico: true,
        generatedBy: 'browser'
    }));

    pngFiles.forEach(({ size, blob }) => {
        formData.append(`png_${size}`, new File([blob], `logo${size}.png`, { type: 'image/png' }));
    });
    formData.append('favicon_ico', new File([faviconIco], 'favicon.ico', { type: ICO_MIME_TYPE }));
    return formData;
};

const normalizeSvgForRendering = (svgText: string) => {
    if (PROCESSING_INSTRUCTION_PATTERN.test(svgText)) {
        throw new Error('SVG 처리 지시자는 허용되지 않습니다.');
    }
    if (DOCTYPE_PATTERN.test(svgText)) {
        throw new Error('SVG DOCTYPE은 허용되지 않습니다.');
    }

    const document = new DOMParser().parseFromString(svgText, SVG_MIME_TYPE);
    const parserError = document.querySelector('parsererror');
    if (parserError) {
        throw new Error('올바른 SVG 파일이 아닙니다.');
    }

    const root = document.documentElement;
    if (root.localName !== 'svg') {
        throw new Error('SVG 파일만 업로드할 수 있습니다.');
    }

    validateSvgForRendering(root);

    const viewBox = parseViewBox(root.getAttribute('viewBox') || '');
    root.setAttribute('width', String(viewBox.width));
    root.setAttribute('height', String(viewBox.height));
    root.setAttribute('viewBox', `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`);
    root.setAttribute('preserveAspectRatio', root.getAttribute('preserveAspectRatio') || 'xMidYMid meet');

    return new XMLSerializer().serializeToString(root);
};

const validateSvgForRendering = (root: Element) => {
    const elements = [
        root,
        ...Array.from(root.querySelectorAll('*'))
    ];

    if (elements.length > SVG_MAX_NODES) {
        throw new Error('SVG 구조가 너무 복잡합니다.');
    }

    elements.forEach((element) => {
        if (!SVG_ALLOWED_TAGS.has(element.localName)) {
            throw new Error(`허용되지 않는 SVG 요소입니다: ${element.localName}`);
        }

        Array.from(element.attributes).forEach((attribute) => {
            const attributeName = attribute.name;
            if (attributeName === 'xmlns' || attributeName.startsWith('xmlns:')) {
                if (!ALLOWED_NAMESPACE_VALUES.has(attribute.value)) {
                    throw new Error('SVG 네임스페이스 값을 확인해주세요.');
                }
                return;
            }

            if (attributeName.toLowerCase().startsWith('on')) {
                throw new Error('허용되지 않는 SVG 속성이 포함되어 있습니다.');
            }
            if (!SVG_ALLOWED_ATTRIBUTES.has(attributeName) && !isSafeMetadataAttribute(attributeName)) {
                throw new Error(`허용되지 않는 SVG 속성입니다: ${attributeName}`);
            }
            if (hasDangerousValue(attribute.value)) {
                throw new Error('SVG에 외부 참조 또는 위험한 값이 포함되어 있습니다.');
            }
        });

        const hasDangerousText = Array.from(element.childNodes).some((node) => (
            node.nodeType === Node.TEXT_NODE
            && hasDangerousValue(node.textContent || '')
        ));
        if (hasDangerousText) {
            throw new Error('SVG 텍스트에 위험한 값이 포함되어 있습니다.');
        }
    });
};

const hasDangerousValue = (value: string) => {
    return DANGEROUS_VALUE_PATTERN.test(value) || EXTERNAL_URL_PATTERN.test(value);
};

const isSafeMetadataAttribute = (attributeName: string) => {
    return attributeName.startsWith('data-') || attributeName.startsWith('aria-');
};

const parseViewBox = (rawValue: string): SvgViewBox => {
    const values = rawValue.trim().split(/[\s,]+/).map(Number);
    if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
        throw new Error('SVG에는 유효한 viewBox가 필요합니다.');
    }

    const [minX, minY, width, height] = values;
    if (width <= 0 || height <= 0) {
        throw new Error('SVG viewBox 크기를 확인해주세요.');
    }
    return {
        minX,
        minY,
        width,
        height
    };
};

const generatePngFiles = async (normalizedSvgText: string): Promise<GeneratedPng[]> => {
    const svgBlobUrl = URL.createObjectURL(new Blob([normalizedSvgText], { type: SVG_MIME_TYPE }));
    try {
        const image = await loadImage(svgBlobUrl);
        const pngFiles: GeneratedPng[] = [];
        for (const size of ICON_PNG_SIZES) {
            pngFiles.push({
                size,
                blob: await drawImageToPng(image, size)
            });
        }
        return pngFiles;
    } finally {
        URL.revokeObjectURL(svgBlobUrl);
    }
};

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('SVG 미리보기 이미지를 생성할 수 없습니다.'));
    image.src = url;
});

const drawImageToPng = (image: HTMLImageElement, size: number) => new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) {
        reject(new Error('아이콘 이미지를 생성할 수 없습니다.'));
        return;
    }

    context.clearRect(0, 0, size, size);
    const sourceWidth = image.naturalWidth || size;
    const sourceHeight = image.naturalHeight || size;
    const scale = Math.min(size / sourceWidth, size / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    const drawX = (size - drawWidth) / 2;
    const drawY = (size - drawHeight) / 2;

    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
    canvas.toBlob((blob) => {
        if (!blob) {
            reject(new Error('PNG 이미지를 생성할 수 없습니다.'));
            return;
        }
        resolve(blob);
    }, 'image/png');
});

const createIcoBlob = async (entries: GeneratedPng[]) => {
    if (entries.length === 0) {
        throw new Error('favicon.ico 생성에 필요한 PNG가 없습니다.');
    }

    const buffers = await Promise.all(entries.map((entry) => entry.blob.arrayBuffer()));
    const headerSize = 6 + entries.length * 16;
    const totalSize = headerSize + buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    const bytes = new Uint8Array(totalSize);
    const view = new DataView(bytes.buffer);

    view.setUint16(0, 0, true);
    view.setUint16(2, 1, true);
    view.setUint16(4, entries.length, true);

    let imageOffset = headerSize;
    entries.forEach((entry, index) => {
        const directoryOffset = 6 + index * 16;
        const buffer = buffers[index];
        const sizeByte = entry.size >= 256 ? 0 : entry.size;

        view.setUint8(directoryOffset, sizeByte);
        view.setUint8(directoryOffset + 1, sizeByte);
        view.setUint8(directoryOffset + 2, 0);
        view.setUint8(directoryOffset + 3, 0);
        view.setUint16(directoryOffset + 4, 1, true);
        view.setUint16(directoryOffset + 6, 32, true);
        view.setUint32(directoryOffset + 8, buffer.byteLength, true);
        view.setUint32(directoryOffset + 12, imageOffset, true);
        bytes.set(new Uint8Array(buffer), imageOffset);
        imageOffset += buffer.byteLength;
    });

    return new Blob([bytes], { type: ICO_MIME_TYPE });
};
