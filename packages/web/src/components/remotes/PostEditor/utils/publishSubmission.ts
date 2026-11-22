import { toReservedDateValue } from './scheduleDate.ts';

export interface PublishFields {
    title: string;
    subtitle: string;
    url: string;
    content: string;
    metaDescription: string;
    hide: boolean;
    advertise: boolean;
    allowComments: boolean;
    tags: string[];
    seriesId: string;
    coverLayout: string;
    coverImagePosition: string;
    coverImageRatio: string;
    imageDeleted?: boolean;
    reservedDate?: string;
}

type PublishResponse =
    | { status: 'DONE'; body: { url: string } }
    | { status: 'ERROR'; errorMessage?: string };

interface PublishSubmission {
    readForm: () => FormData;
    fields: PublishFields;
    /** Settles any in-flight autosave and returns the draft it belongs to. */
    settleDraft: () => Promise<string | undefined>;
    send: (payload: FormData) => Promise<{ data: PublishResponse }>;
    fallbackError: string;
    onPublished: (postUrl: string) => void;
    onRejected: (message: string) => void;
}

export const buildPublishPayload = (
    source: FormData,
    fields: PublishFields,
    draftUrl?: string
) => {
    const payload = source;
    payload.set('title', fields.title);
    payload.set('subtitle', fields.subtitle);
    payload.set('url', fields.url);
    payload.set('contentHtml', fields.content);
    payload.set('metaDescription', fields.metaDescription);
    payload.set('hide', String(fields.hide));
    payload.set('advertise', String(fields.advertise));
    payload.set('blockComment', String(!fields.allowComments));
    payload.set('tag', fields.tags.join(','));
    payload.set('series', fields.seriesId);
    payload.set('coverLayout', fields.coverLayout);
    payload.set('coverImagePosition', fields.coverImagePosition);
    payload.set('coverImageRatio', fields.coverImageRatio);

    if (fields.reservedDate) {
        payload.set('reservedDate', toReservedDateValue(fields.reservedDate));
    } else {
        payload.delete('reservedDate');
    }

    if (fields.imageDeleted) {
        payload.delete('image');
        payload.set('imageDelete', 'true');
    } else {
        payload.delete('imageDelete');
    }

    if (draftUrl) {
        payload.set('draftUrl', draftUrl);
    } else {
        payload.delete('draftUrl');
    }

    return payload;
};

/** Reads the plain-text answer of a guard that rejects the request before the API runs. */
const readRejectedRequest = (error: unknown) => {
    if (typeof error !== 'object' || error === null || !('response' in error)) return '';
    const { response } = error as { response?: { status?: number; data?: unknown } };
    if (response?.status === 404 || typeof response?.data !== 'string') return '';
    return response.data.trim();
};

/** Publishing never leaves the editor until the server accepts the post. */
export const submitPublish = async ({
    readForm,
    fields,
    settleDraft,
    send,
    fallbackError,
    onPublished,
    onRejected
}: PublishSubmission) => {
    let response: PublishResponse;
    try {
        const draftUrl = await settleDraft();
        ({ data: response } = await send(buildPublishPayload(readForm(), fields, draftUrl)));
    } catch (error) {
        onRejected(readRejectedRequest(error) || fallbackError);
        return;
    }

    if (response.status === 'DONE') {
        onPublished(response.body.url);
        return;
    }
    onRejected(response.errorMessage || fallbackError);
};
