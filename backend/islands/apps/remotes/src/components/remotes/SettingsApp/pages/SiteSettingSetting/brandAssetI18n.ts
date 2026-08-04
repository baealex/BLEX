import type { MessageDescriptor } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import type {
    BrandAssetGenerationError,
    BrandAssetGenerationErrorCode
} from './brandAssetGenerator';

const brandAssetGenerationErrorMessages: Record<BrandAssetGenerationErrorCode, MessageDescriptor> = {
    svg_processing_instruction: msg({
        id: 'settings.site.brand.error.svg_processing_instruction',
        message: 'SVG processing instructions are not allowed.'
    }),
    svg_doctype: msg({
        id: 'settings.site.brand.error.svg_doctype',
        message: 'SVG DOCTYPE declarations are not allowed.'
    }),
    svg_invalid: msg({
        id: 'settings.site.brand.error.svg_invalid',
        message: 'This is not a valid SVG file.'
    }),
    svg_only: msg({
        id: 'settings.site.brand.error.svg_only',
        message: 'Only SVG files can be uploaded.'
    }),
    svg_too_complex: msg({
        id: 'settings.site.brand.error.svg_too_complex',
        message: 'The SVG structure is too complex.'
    }),
    svg_unsupported_element: msg({
        id: 'settings.site.brand.error.svg_unsupported_element',
        message: 'Unsupported SVG element: {detail}'
    }),
    svg_invalid_namespace: msg({
        id: 'settings.site.brand.error.svg_invalid_namespace',
        message: 'Check the SVG namespace value.'
    }),
    svg_event_attribute: msg({
        id: 'settings.site.brand.error.svg_event_attribute',
        message: 'The SVG contains an event handler attribute.'
    }),
    svg_unsupported_attribute: msg({
        id: 'settings.site.brand.error.svg_unsupported_attribute',
        message: 'Unsupported SVG attribute: {detail}'
    }),
    svg_unsafe_value: msg({
        id: 'settings.site.brand.error.svg_unsafe_value',
        message: 'The SVG contains an external reference or unsafe value.'
    }),
    svg_unsafe_text: msg({
        id: 'settings.site.brand.error.svg_unsafe_text',
        message: 'The SVG text contains an unsafe value.'
    }),
    svg_invalid_viewbox: msg({
        id: 'settings.site.brand.error.svg_invalid_viewbox',
        message: 'The SVG must have a valid viewBox.'
    }),
    svg_invalid_viewbox_size: msg({
        id: 'settings.site.brand.error.svg_invalid_viewbox_size',
        message: 'Check the SVG viewBox dimensions.'
    }),
    svg_preview_failed: msg({
        id: 'settings.site.brand.error.svg_preview_failed',
        message: 'Could not generate the SVG preview image.'
    }),
    icon_generation_failed: msg({
        id: 'settings.site.brand.error.icon_generation_failed',
        message: 'Could not generate the icon image.'
    }),
    png_generation_failed: msg({
        id: 'settings.site.brand.error.png_generation_failed',
        message: 'Could not generate the PNG image.'
    }),
    favicon_png_missing: msg({
        id: 'settings.site.brand.error.favicon_png_missing',
        message: 'No PNG image is available to create favicon.ico.'
    })
};

export const getBrandAssetGenerationErrorMessage = (
    error: BrandAssetGenerationError
): MessageDescriptor => ({
    ...brandAssetGenerationErrorMessages[error.code],
    ...(error.detail ? { values: { detail: error.detail } } : {})
});
