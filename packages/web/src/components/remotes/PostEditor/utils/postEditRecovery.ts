const POST_EDIT_RECOVERY_VERSION = 1;
const POST_EDIT_RECOVERY_PREFIX = 'blex:post-edit-recovery';

export interface PostEditRecoverySnapshot {
    title: string;
    subtitle: string;
    content: string;
    metaDescription: string;
    hide: boolean;
    advertise: boolean;
    allowComments: boolean;
    coverLayout: string;
    coverImagePosition: string;
    coverImageRatio: string;
    reservedDate: string;
    tags: string[];
    seriesUrl: string;
    imageDeleted: boolean;
}

export interface PostEditRecovery {
    savedAt: string;
    snapshot: PostEditRecoverySnapshot;
}

interface StoredPostEditRecovery extends PostEditRecovery {
    version: number;
    username: string;
    postUrl: string;
    baseRevision: string;
}

interface RecoveryIdentity {
    username: string;
    postUrl: string;
}

interface ReadPostEditRecoveryOptions extends RecoveryIdentity {
    baseRevision: string;
    baseline: PostEditRecoverySnapshot;
}

interface WritePostEditRecoveryOptions extends RecoveryIdentity {
    baseRevision: string;
    snapshot: PostEditRecoverySnapshot;
}

const getLocalStorage = () => {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null
);

const isRecoverySnapshot = (value: unknown): value is PostEditRecoverySnapshot => {
    if (!isRecord(value)) return false;

    const stringFields = [
        'title',
        'subtitle',
        'content',
        'metaDescription',
        'coverLayout',
        'coverImagePosition',
        'coverImageRatio',
        'reservedDate',
        'seriesUrl'
    ];
    const booleanFields = [
        'hide',
        'advertise',
        'allowComments',
        'imageDeleted'
    ];

    return stringFields.every(field => typeof value[field] === 'string')
        && booleanFields.every(field => typeof value[field] === 'boolean')
        && Array.isArray(value.tags)
        && value.tags.every(tag => typeof tag === 'string');
};

const isStoredRecovery = (value: unknown): value is StoredPostEditRecovery => (
    isRecord(value)
    && value.version === POST_EDIT_RECOVERY_VERSION
    && typeof value.username === 'string'
    && typeof value.postUrl === 'string'
    && typeof value.baseRevision === 'string'
    && typeof value.savedAt === 'string'
    && !Number.isNaN(Date.parse(value.savedAt))
    && isRecoverySnapshot(value.snapshot)
);

const snapshotsMatch = (
    left: PostEditRecoverySnapshot,
    right: PostEditRecoverySnapshot
) => JSON.stringify(left) === JSON.stringify(right);

export const buildPostEditRecoveryKey = ({ username, postUrl }: RecoveryIdentity) => (
    `${POST_EDIT_RECOVERY_PREFIX}:v${POST_EDIT_RECOVERY_VERSION}:${encodeURIComponent(username)}:${encodeURIComponent(postUrl)}`
);

export const readPostEditRecovery = ({
    username,
    postUrl,
    baseRevision,
    baseline
}: ReadPostEditRecoveryOptions): PostEditRecovery | null => {
    const storage = getLocalStorage();
    if (!storage) return null;

    const key = buildPostEditRecoveryKey({
        username,
        postUrl
    });
    try {
        const rawRecovery = storage.getItem(key);
        if (!rawRecovery) return null;

        const recovery: unknown = JSON.parse(rawRecovery);
        if (
            !isStoredRecovery(recovery)
            || recovery.username !== username
            || recovery.postUrl !== postUrl
            || recovery.baseRevision !== baseRevision
            || snapshotsMatch(recovery.snapshot, baseline)
        ) {
            storage.removeItem(key);
            return null;
        }

        return {
            savedAt: recovery.savedAt,
            snapshot: recovery.snapshot
        };
    } catch {
        try {
            storage.removeItem(key);
        } catch {
            // Storage can become unavailable between reads and cleanup.
        }
        return null;
    }
};

export const writePostEditRecovery = ({
    username,
    postUrl,
    baseRevision,
    snapshot
}: WritePostEditRecoveryOptions) => {
    const storage = getLocalStorage();
    if (!storage) return false;

    const recovery: StoredPostEditRecovery = {
        version: POST_EDIT_RECOVERY_VERSION,
        username,
        postUrl,
        baseRevision,
        savedAt: new Date().toISOString(),
        snapshot
    };

    try {
        storage.setItem(
            buildPostEditRecoveryKey({
                username,
                postUrl
            }),
            JSON.stringify(recovery)
        );
        return true;
    } catch {
        return false;
    }
};

export const clearPostEditRecovery = (identity: RecoveryIdentity) => {
    const storage = getLocalStorage();
    if (!storage) return;

    try {
        storage.removeItem(buildPostEditRecoveryKey(identity));
    } catch {
        // Local recovery is best-effort and must never block editing.
    }
};

export const postEditRecoverySnapshotsMatch = snapshotsMatch;
