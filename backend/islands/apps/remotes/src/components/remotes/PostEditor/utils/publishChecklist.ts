import { i18n } from '~/i18n';
import type { AppLocale } from '~/i18n/locale';

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

const formatScheduledAt = (value: string, locale: AppLocale) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
};

export const getPublishChecklist = (
    input: PublishChecklistInput,
    locale: AppLocale
): PublishChecklistResult => {
    const items: PublishChecklistItem[] = [
        {
            id: 'title',
            label: i18n._({
                id: 'editor.publish.field.title',
                message: 'Title'
            }),
            description: i18n._({
                id: 'editor.publish.field.title_description',
                message: 'Readers need a title to identify this post.'
            }),
            severity: 'required',
            status: hasText(input.title) ? 'pass' : 'missing'
        },
        {
            id: 'content',
            label: i18n._({
                id: 'editor.publish.field.content',
                message: 'Content'
            }),
            description: i18n._({
                id: 'editor.publish.field.content_description',
                message: 'Add some content before publishing.'
            }),
            severity: 'required',
            status: hasPublishableContent(input.content) ? 'pass' : 'missing'
        },
        {
            id: 'description',
            label: i18n._({
                id: 'editor.publish.field.description',
                message: 'Description'
            }),
            description: i18n._({
                id: 'editor.publish.field.description_description',
                message: 'Describe the post in search results and shared links. You can still publish without it.'
            }),
            severity: 'recommended',
            status: hasText(input.description) ? 'pass' : 'missing'
        },
        {
            id: 'tags',
            label: i18n._({
                id: 'editor.publish.field.tags',
                message: 'Tags'
            }),
            description: i18n._({
                id: 'editor.publish.field.tags_description',
                message: 'Group related posts and help readers discover similar posts.'
            }),
            severity: 'recommended',
            status: input.tags.length > 0 ? 'pass' : 'missing'
        },
        {
            id: 'coverImage',
            label: i18n._({
                id: 'editor.publish.field.cover_image',
                message: 'Cover image'
            }),
            description: i18n._({
                id: 'editor.publish.field.cover_image_description',
                message: 'Set the first impression in listings and shared cards. This does not replace images in the post.'
            }),
            severity: 'recommended',
            status: input.hasCoverImage ? 'pass' : 'missing'
        }
    ];

    const missingRequired = items.filter(item => item.severity === 'required' && item.status === 'missing');
    const missingRecommended = items.filter(item => item.severity === 'recommended' && item.status === 'missing');
    const scheduledLabel = input.scheduledAt ? formatScheduledAt(input.scheduledAt, locale) : '';
    const visibilityTitle = input.scheduledAt
        ? (input.isHidden
            ? i18n._({
                id: 'editor.publish.visibility.private_scheduled_title',
                message: 'This is a private scheduled post'
            })
            : i18n._({
                id: 'editor.publish.visibility.scheduled_title',
                message: 'This post will be published on schedule'
            }))
        : (input.isHidden
            ? i18n._({
                id: 'editor.publish.visibility.private_title',
                message: 'This post will be private'
            })
            : i18n._({
                id: 'editor.publish.visibility.public_title',
                message: 'This post will be public'
            }));
    const visibilityDescription = input.scheduledAt
        ? i18n._({
            id: 'editor.publish.visibility.scheduled_description',
            message: 'This post will be published on {scheduledAt}. Only you can view it before then.',
            values: { scheduledAt: scheduledLabel }
        })
        : input.isHidden
            ? i18n._({
                id: 'editor.publish.visibility.private_description',
                message: 'Only you can view it. It will be excluded from public URLs, RSS, sitemaps, and Markdown endpoints.'
            })
            : i18n._({
                id: 'editor.publish.visibility.public_description',
                message: 'It will be available at its public URL immediately and included in RSS and sitemaps.'
            });

    return {
        items,
        missingRequired,
        missingRecommended,
        canPublish: missingRequired.length === 0,
        visibilityTitle,
        visibilityDescription,
        confirmLabel: input.scheduledAt
            ? i18n._({
                id: 'editor.publish.confirm_schedule',
                message: 'Review and schedule'
            })
            : i18n._({
                id: 'editor.publish.confirm_publish',
                message: 'Review and publish'
            }),
        submittingLabel: input.scheduledAt
            ? i18n._({
                id: 'editor.publish.scheduling',
                message: 'Scheduling...'
            })
            : i18n._({
                id: 'editor.publish.publishing',
                message: 'Publishing...'
            })
    };
};
