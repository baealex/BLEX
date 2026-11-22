export type ContentType = 'html' | 'markdown';
export type CoverLayout = 'default' | 'split' | 'overlay' | 'none';
export type CoverImagePosition = 'left' | 'right';
export type CoverImageRatio = 'auto' | '16:9' | '4:3' | '1:1' | '3:4';

export interface CoverSettings {
    coverLayout: CoverLayout;
    coverImagePosition: CoverImagePosition;
    coverImageRatio: CoverImageRatio;
}

export interface Series {
    id: string;
    name: string;
    url: string;
}
