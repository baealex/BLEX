import { AlertTriangle, CheckCircle, Info } from '@blex/ui/icons';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '@blex/ui/modal';
import type { PublishChecklistItem, PublishChecklistResult } from '../utils/publishChecklist';

interface PublishChecklistProps {
    isOpen: boolean;
    result: PublishChecklistResult;
    isSubmitting: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

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
    const { i18n, t } = useLingui();
    const title = result.canPublish
        ? t({
            id: 'editor.publish.checklist_ready_title',
            message: 'Final review before publishing'
        })
        : t({
            id: 'editor.publish.checklist_missing_title',
            message: 'Complete the required fields'
        });
    const description = result.canPublish
        ? t({
            id: 'editor.publish.checklist_ready_description',
            message: 'All required fields are ready. You can add recommended details later.'
        })
        : t({
            id: 'editor.publish.checklist_missing_description',
            message: 'Complete the required fields before publishing.'
        });

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

                <div className="rounded-xl border border-line bg-surface-subtle px-4 py-3">
                    <p className="text-sm font-semibold text-content">{result.visibilityTitle}</p>
                    <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                        {result.visibilityDescription}
                    </p>
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
                                            {item.severity === 'required' ? (
                                                <Trans id="editor.publish.required">Required</Trans>
                                            ) : (
                                                <Trans id="editor.publish.recommended">Recommended</Trans>
                                            )}
                                        </span>
                                        <span className="text-xs text-content-hint">
                                            {item.status === 'pass' ? (
                                                <Trans id="editor.publish.complete">Complete</Trans>
                                            ) : (
                                                <Trans id="editor.publish.empty">Empty</Trans>
                                            )}
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
                        <p className="text-sm font-semibold text-warning">
                            <Trans id="editor.publish.recommended_empty">
                                Some recommended fields are empty.
                            </Trans>
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-content-secondary">
                            {i18n._({
                                id: 'editor.publish.recommended_later',
                                message: 'You can add these later: {fields}',
                                values: { fields: result.missingRecommended.map(item => item.label).join(', ') }
                            })}
                        </p>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Modal.FooterAction
                    type="button"
                    variant="secondary"
                    onClick={onClose}>
                    <Trans id="common.cancel">Cancel</Trans>
                </Modal.FooterAction>
                <Modal.FooterAction
                    type="button"
                    variant="primary"
                    disabled={!result.canPublish || isSubmitting}
                    onClick={onConfirm}>
                    {isSubmitting ? result.submittingLabel : result.confirmLabel}
                </Modal.FooterAction>
            </Modal.Footer>
        </Modal>
    );
};

export default PublishChecklist;
