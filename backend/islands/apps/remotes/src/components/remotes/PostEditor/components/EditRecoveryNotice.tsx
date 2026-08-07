import { Trans, useLingui } from '@lingui/react/macro';
import { Alert } from '@blex/ui/alert';
import { Button } from '@blex/ui/button';
import { RotateCw, Trash2 } from '@blex/ui/icons';
import { normalizeLocale } from '~/i18n/locale';
import type { PostEditRecovery } from '../utils/postEditRecovery';

interface EditRecoveryNoticeProps {
    recovery: PostEditRecovery;
    onRecover: () => void;
    onDiscard: () => void;
}

const EditRecoveryNotice = ({
    recovery,
    onRecover,
    onDiscard
}: EditRecoveryNoticeProps) => {
    const { i18n, t } = useLingui();
    const savedDate = new Date(recovery.savedAt);
    const savedAt = Number.isNaN(savedDate.getTime())
        ? recovery.savedAt
        : new Intl.DateTimeFormat(normalizeLocale(i18n.locale), {
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(savedDate);

    return (
        <section
            className="mb-4"
            aria-label={t({
                id: 'editor.recovery.aria_label',
                message: 'Post edit backup'
            })}
            data-post-edit-recovery>
            <Alert
                variant="warning"
                title={t({
                    id: 'editor.recovery.title',
                    message: 'You have unsaved edits'
                })}>
                <p>
                    <Trans id="editor.recovery.description">
                        You can recover edits saved in this browser. The published post has not changed.
                    </Trans>
                </p>
                <p className="mt-1 text-xs text-content-hint">
                    <Trans id="editor.recovery.last_backup">Last backup</Trans>{' '}
                    <time dateTime={recovery.savedAt}>{savedAt}</time>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={onRecover}
                        leftIcon={<RotateCw className="h-4 w-4" />}>
                        <Trans id="editor.recovery.recover">Recover</Trans>
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={onDiscard}
                        leftIcon={<Trash2 className="h-4 w-4" />}>
                        <Trans id="editor.recovery.delete_backup">Delete backup</Trans>
                    </Button>
                </div>
            </Alert>
        </section>
    );
};

export default EditRecoveryNotice;
