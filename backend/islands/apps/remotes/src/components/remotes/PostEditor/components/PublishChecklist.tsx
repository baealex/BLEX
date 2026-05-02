import { AlertTriangle, CheckCircle, Info } from '@blex/ui/icons';
import { Modal } from '@blex/ui/modal';
import type { PublishChecklistItem, PublishChecklistResult } from '../utils/publishChecklist';

interface PublishChecklistProps {
    isOpen: boolean;
    result: PublishChecklistResult;
    isSubmitting: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const severityLabel = (item: PublishChecklistItem) => (
    item.severity === 'required' ? '필수' : '권장'
);

const itemClassName = (item: PublishChecklistItem) => {
    if (item.status === 'pass') {
        return 'border-line bg-surface-subtle text-content-secondary';
    }

    if (item.severity === 'required') {
        return 'border-danger-line bg-danger-surface text-content';
    }

    return 'border-warning-line bg-warning-surface text-content';
};

const itemIcon = (item: PublishChecklistItem) => {
    if (item.status === 'pass') {
        return <CheckCircle className="h-4 w-4 text-success" />;
    }

    if (item.severity === 'required') {
        return <AlertTriangle className="h-4 w-4 text-danger" />;
    }

    return <Info className="h-4 w-4 text-warning" />;
};

const PublishChecklist = ({
    isOpen,
    result,
    isSubmitting,
    onClose,
    onConfirm
}: PublishChecklistProps) => {
    const title = result.canPublish ? '발행 전 최종 확인' : '발행 전에 꼭 채워주세요';
    const description = result.canPublish
        ? '필수 항목은 준비되었습니다. 권장 항목은 나중에 보완할 수 있습니다.'
        : '필수 항목을 채워주세요.';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            maxWidth="3xl">
            <Modal.Body className="space-y-5">
                <div>
                    <p className="text-sm leading-relaxed text-content-secondary">{description}</p>
                </div>

                <div className="space-y-2" aria-live="polite">
                    {result.items.map(item => (
                        <div
                            key={item.id}
                            className={`rounded-xl border px-3 py-2 transition-colors duration-150 ${itemClassName(item)}`}>
                            <div className="flex items-start gap-3">
                                {itemIcon(item)}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold">{item.label}</span>
                                        <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-content-hint">
                                            {severityLabel(item)}
                                        </span>
                                        <span className="text-xs text-content-hint">
                                            {item.status === 'pass' ? '작성됨' : '비어 있음'}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {result.missingRecommended.length > 0 && result.canPublish && (
                    <div className="rounded-xl border border-warning-line bg-warning-surface px-4 py-3">
                        <p className="text-sm font-semibold text-warning">권장 항목이 비어 있습니다.</p>
                        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                            {result.missingRecommended.map(item => item.label).join(', ')}은 나중에 보완할 수 있습니다.
                        </p>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Modal.FooterAction
                    type="button"
                    variant="secondary"
                    onClick={onClose}>
                    취소
                </Modal.FooterAction>
                <Modal.FooterAction
                    type="button"
                    variant="primary"
                    disabled={!result.canPublish || isSubmitting}
                    onClick={onConfirm}>
                    {isSubmitting ? '발행 중...' : '확인 후 발행'}
                </Modal.FooterAction>
            </Modal.Footer>
        </Modal>
    );
};

export default PublishChecklist;
