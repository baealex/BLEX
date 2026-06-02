import { lazy, Suspense, useState } from 'react';
import { Modal } from '~/components/shared';

const PinnedPostsPanel = lazy(() =>
    import('~/components/remotes/SettingsApp/pages/PinnedPostsSetting/components/PinnedPostsPanel')
        .then(module => ({ default: module.PinnedPostsPanel }))
);

const PinnedPostQuickAction = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const handleOpen = () => {
        setHasChanges(false);
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setIsModalOpen(false);
        if (hasChanges) {
            window.setTimeout(() => {
                window.location.reload();
            }, 150);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={handleOpen}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-surface-subtle px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle/80 hover:text-content">
                <i className="fas fa-thumbtack mr-2 text-xs" />
                고정 포스트 설정
            </button>

            <Modal
                isOpen={isModalOpen}
                onClose={handleClose}
                title="고정 포스트 설정"
                maxWidth="3xl">
                <Modal.Body className="max-h-[70vh] overflow-y-auto">
                    {isModalOpen && (
                        <Suspense
                            fallback={
                                <div className="flex h-48 items-center justify-center text-content-secondary">
                                    <i className="fas fa-spinner fa-spin mr-2" />
                                    고정 포스트를 불러오는 중...
                                </div>
                            }>
                            <PinnedPostsPanel
                                embedded
                                onPinnedPostsChange={() => setHasChanges(true)}
                            />
                        </Suspense>
                    )}
                </Modal.Body>
            </Modal>
        </>
    );
};

export default PinnedPostQuickAction;
