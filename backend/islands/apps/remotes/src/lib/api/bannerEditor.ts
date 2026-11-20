import { http, type Response } from '../http.module';
import type { BannerPreviewData, BannerTemplateGalleryItem } from './settings';

// Only the banner editor uses these, so they stay out of the API code shared by every island.

export const getBannerTemplates = async () => {
    return http.get<Response<{ templates: BannerTemplateGalleryItem[] }>>('v1/banners/templates');
};

export const previewBanner = async (data: BannerPreviewData, signal?: AbortSignal) => {
    return http.post<Response<{ html: string }>>('v1/banners/preview', data, {
        signal,
        headers: { 'Content-Type': 'application/json' }
    });
};

export const getGlobalBannerTemplates = async () => {
    return http.get<Response<{ templates: BannerTemplateGalleryItem[] }>>('v1/global-banners/templates');
};

export const previewGlobalBanner = async (data: BannerPreviewData, signal?: AbortSignal) => {
    return http.post<Response<{ html: string }>>('v1/global-banners/preview', data, {
        signal,
        headers: { 'Content-Type': 'application/json' }
    });
};
