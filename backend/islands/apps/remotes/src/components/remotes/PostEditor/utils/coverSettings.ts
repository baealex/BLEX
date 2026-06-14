import type { CoverImageRatio, CoverLayout } from '../types';

export const COVER_LAYOUT_OPTIONS: Array<{
    value: CoverLayout;
    label: string;
    description: string;
}> = [
    {
        value: 'default',
        label: '기본',
        description: '제목 다음에 이미지가 자연스럽게 이어집니다.'
    },
    {
        value: 'split',
        label: '분할',
        description: '제목과 대표 이미지를 좌우로 배치합니다.'
    },
    {
        value: 'overlay',
        label: '이미지 배경',
        description: '이미지를 넓게 깔고 제목을 이미지 위에 올립니다.'
    },
    {
        value: 'none',
        label: '커버 숨김',
        description: '대표 이미지는 공유와 목록에만 사용하고 포스트 상단에는 보이지 않습니다.'
    }
];

export const COVER_RATIO_ITEMS = [
    {
        value: 'auto',
        label: '원본 비율'
    },
    {
        value: '16:9',
        label: '16:9 와이드'
    },
    {
        value: '4:3',
        label: '4:3 표준'
    },
    {
        value: '1:1',
        label: '1:1 정사각'
    },
    {
        value: '3:4',
        label: '3:4 세로형'
    }
];

export const COVER_POSITION_ITEMS = [
    {
        value: 'right',
        label: '이미지 오른쪽'
    },
    {
        value: 'left',
        label: '이미지 왼쪽'
    }
];

export const getCoverRatioClass = (ratio: CoverImageRatio | string) => {
    switch (ratio) {
        case '1:1':
            return 'aspect-square';
        case '4:3':
            return 'aspect-[4/3]';
        case '3:4':
            return 'aspect-[3/4]';
        default:
            return 'aspect-[16/9]';
    }
};

export const supportsCoverImagePosition = (layout: CoverLayout | string) => layout === 'split';

export const supportsCoverImageRatio = (layout: CoverLayout | string) => (
    layout === 'default' || layout === 'split'
);
