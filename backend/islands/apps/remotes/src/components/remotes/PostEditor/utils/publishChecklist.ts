export type PublishChecklistSeverity = 'required' | 'recommended';
export type PublishChecklistStatus = 'pass' | 'missing';

export interface PublishChecklistItem {
    id: 'title' | 'content' | 'description' | 'tags' | 'coverImage';
    label: string;
    description: string;
    severity: PublishChecklistSeverity;
    status: PublishChecklistStatus;
}

export interface PublishChecklistInput {
    title: string;
    content: string;
    description: string;
    tags: string[];
    hasCoverImage: boolean;
    isHidden: boolean;
    scheduledAt?: string;
}

export interface PublishChecklistResult {
    items: PublishChecklistItem[];
    missingRequired: PublishChecklistItem[];
    missingRecommended: PublishChecklistItem[];
    canPublish: boolean;
    visibilityTitle: string;
    visibilityDescription: string;
    confirmLabel: string;
    submittingLabel: string;
}

const hasText = (value: string) => value.trim().length > 0;

export const hasPublishableContent = (value: string) => {
    if (/<(img|video|iframe|table|pre)\b/i.test(value)) {
        return true;
    }

    const text = value
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim();

    return text.length > 0;
};

const formatScheduledAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short'
    });
};

export const getPublishChecklist = (input: PublishChecklistInput): PublishChecklistResult => {
    const items: PublishChecklistItem[] = [
        {
            id: 'title',
            label: '제목',
            description: '독자가 포스트를 구분할 수 있는 제목이 필요합니다.',
            severity: 'required',
            status: hasText(input.title) ? 'pass' : 'missing'
        },
        {
            id: 'content',
            label: '본문',
            description: '발행하려면 본문 내용이 필요합니다.',
            severity: 'required',
            status: hasPublishableContent(input.content) ? 'pass' : 'missing'
        },
        {
            id: 'description',
            label: '설명',
            description: '검색 결과와 공유 화면에서 포스트를 설명합니다. 비워도 발행은 가능합니다.',
            severity: 'recommended',
            status: hasText(input.description) ? 'pass' : 'missing'
        },
        {
            id: 'tags',
            label: '태그',
            description: '관련 포스트를 묶고 독자가 비슷한 포스트를 찾기 쉽게 만듭니다.',
            severity: 'recommended',
            status: input.tags.length > 0 ? 'pass' : 'missing'
        },
        {
            id: 'coverImage',
            label: '커버 이미지',
            description: '목록과 공유 카드에서 포스트의 첫인상을 만듭니다. 본문 이미지를 대신 쓰지는 않습니다.',
            severity: 'recommended',
            status: input.hasCoverImage ? 'pass' : 'missing'
        }
    ];

    const missingRequired = items.filter(item => item.severity === 'required' && item.status === 'missing');
    const missingRecommended = items.filter(item => item.severity === 'recommended' && item.status === 'missing');
    const scheduledLabel = input.scheduledAt ? formatScheduledAt(input.scheduledAt) : '';
    const visibilityTitle = input.scheduledAt
        ? (input.isHidden ? '비공개 예약 포스트입니다' : '예약 발행됩니다')
        : (input.isHidden ? '비공개로 발행됩니다' : '공개로 발행됩니다');
    const visibilityDescription = input.scheduledAt
        ? `${scheduledLabel}에 발행됩니다. 예약 시각 전에는 작성자만 볼 수 있습니다.`
        : input.isHidden
            ? '작성자만 볼 수 있으며 공개 URL, RSS, Sitemap, Markdown 노출에서 제외됩니다.'
            : '발행 후 공개 URL에서 바로 확인할 수 있고 RSS와 Sitemap에 반영됩니다.';

    return {
        items,
        missingRequired,
        missingRecommended,
        canPublish: missingRequired.length === 0,
        visibilityTitle,
        visibilityDescription,
        confirmLabel: input.scheduledAt ? '확인 후 예약' : '확인 후 발행',
        submittingLabel: input.scheduledAt ? '예약 중...' : '발행 중...'
    };
};
