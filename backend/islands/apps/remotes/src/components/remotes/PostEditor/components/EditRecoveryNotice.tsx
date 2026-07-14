import { Alert } from '@blex/ui/alert';
import { Button } from '@blex/ui/button';
import { RotateCw, Trash2 } from '@blex/ui/icons';
import type { PostEditRecovery } from '../utils/postEditRecovery';

interface EditRecoveryNoticeProps {
    recovery: PostEditRecovery;
    onRecover: () => void;
    onDiscard: () => void;
}

const formatSavedAt = (savedAt: string) => new Date(savedAt).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});

const EditRecoveryNotice = ({
    recovery,
    onRecover,
    onDiscard
}: EditRecoveryNoticeProps) => (
    <section
        className="mb-4"
        aria-label="포스트 수정 백업"
        data-post-edit-recovery>
        <Alert variant="warning" title="저장되지 않은 수정 내용이 있습니다">
            <p>이 브라우저에 남아 있는 편집 내용을 복구할 수 있습니다. 공개된 글은 아직 바뀌지 않았습니다.</p>
            <p className="mt-1 text-xs text-content-hint">
                마지막 백업 <time dateTime={recovery.savedAt}>{formatSavedAt(recovery.savedAt)}</time>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={onRecover}
                    leftIcon={<RotateCw className="h-4 w-4" />}>
                    복구
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={onDiscard}
                    leftIcon={<Trash2 className="h-4 w-4" />}>
                    백업 삭제
                </Button>
            </div>
        </Alert>
    </section>
);

export default EditRecoveryNotice;
