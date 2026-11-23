import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type { BrandAssetGenerationError, BrandAssetGenerationErrorCode } from './brandAssetGenerator';

const brandAssetGenerationErrorMessages: Record<BrandAssetGenerationErrorCode, MessageDescriptor> = {
    svgProcessingInstruction: msg({
        id: 'settings.site.brand.error.svg_processing_instruction',
        message: 'SVG processing instructions are not allowed.'
    }),
    svgDoctype: msg({
        id: 'settings.site.brand.error.svg_doctype',
        message: 'SVG DOCTYPE declarations are not allowed.'
    }),
    svgInvalid: msg({
        id: 'settings.site.brand.error.svg_invalid',
        message: 'This is not a valid SVG file.'
    }),
    svgOnly: msg({
        id: 'settings.site.brand.error.svg_only',
        message: 'Only SVG files can be uploaded.'
    }),
    svgTooComplex: msg({
        id: 'settings.site.brand.error.svg_too_complex',
        message: 'The SVG structure is too complex.'
    }),
    svgUnsupportedElement: msg({
        id: 'settings.site.brand.error.svg_unsupported_element',
        message: 'Unsupported SVG element: {detail}'
    }),
    svgInvalidNamespace: msg({
        id: 'settings.site.brand.error.svg_invalid_namespace',
        message: 'Check the SVG namespace value.'
    }),
    svgEventAttribute: msg({
        id: 'settings.site.brand.error.svg_event_attribute',
        message: 'The SVG contains an event handler attribute.'
    }),
    svgUnsupportedAttribute: msg({
        id: 'settings.site.brand.error.svg_unsupported_attribute',
        message: 'Unsupported SVG attribute: {detail}'
    }),
    svgUnsafeValue: msg({
        id: 'settings.site.brand.error.svg_unsafe_value',
        message: 'The SVG contains an external reference or unsafe value.'
    }),
    svgUnsafeText: msg({
        id: 'settings.site.brand.error.svg_unsafe_text',
        message: 'The SVG text contains an unsafe value.'
    }),
    svgInvalidViewbox: msg({
        id: 'settings.site.brand.error.svg_invalid_viewbox',
        message: 'The SVG must have a valid viewBox.'
    }),
    svgInvalidViewboxSize: msg({
        id: 'settings.site.brand.error.svg_invalid_viewbox_size',
        message: 'Check the SVG viewBox dimensions.'
    }),
    svgPreviewFailed: msg({
        id: 'settings.site.brand.error.svg_preview_failed',
        message: 'Could not generate the SVG preview image.'
    }),
    iconGenerationFailed: msg({
        id: 'settings.site.brand.error.icon_generation_failed',
        message: 'Could not generate the icon image.'
    }),
    pngGenerationFailed: msg({
        id: 'settings.site.brand.error.png_generation_failed',
        message: 'Could not generate the PNG image.'
    }),
    faviconPngMissing: msg({
        id: 'settings.site.brand.error.favicon_png_missing',
        message: 'No PNG image is available to create favicon.ico.'
    })
};

export const getBrandAssetGenerationErrorMessage = (error: BrandAssetGenerationError): MessageDescriptor => ({
    ...brandAssetGenerationErrorMessages[error.code],
    ...(error.detail ? { values: { detail: error.detail } } : {})
});
