import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trans, useLingui } from '@lingui/react/macro';
import { Modal } from '~/components/shared';
import { getPinnedPosts } from '~/lib/api/settings';
import { refreshPartialElement } from '~/utils/partialRefresh';

const loadPinnedPostsPanel = () =>
    import('~/components/remotes/SettingsApp/pages/PinnedPostsSetting/components/PinnedPostsPanel')
        .then(module => ({ default: module.PinnedPostsPanel }));

const PinnedPostsPanel = lazy(loadPinnedPostsPanel);

const FEATURED_POSTS_SELECTOR = '[data-featured-posts-section]';
const MODAL_CLOSE_REFRESH_DELAY_MS = 300;

interface PinnedPostQuickActionProps {
    partialUrl?: string;
}

const PinnedPostQuickAction = ({ partialUrl }: PinnedPostQuickActionProps) => {
    const { t } = useLingui();
    const queryClient = useQueryClient();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const isRefreshingRef = useRef(false);
    const refreshTimeoutRef = useRef<number | null>(null);

    const cancelScheduledRefresh = useCallback(() => {
        if (refreshTimeoutRef.current === null) return;

        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
        isRefreshingRef.current = false;
    }, []);

    const preloadPinnedPostsPanel = useCallback(() => {
        void loadPinnedPostsPanel();
        void queryClient.prefetchQuery({
            queryKey: ['pinned-posts-setting'],
            queryFn: async () => {
                const { data } = await getPinnedPosts();
                if (data.status === 'DONE') {
                    return data.body;
                }
                throw new Error(t({
                    id: 'settings.pinned_posts.error.load',
                    message: 'Could not load pinned posts.'
                }));
            },
            staleTime: 30_000
        });
    }, [queryClient, t]);

    useEffect(() => {
        return () => cancelScheduledRefresh();
    }, [cancelScheduledRefresh]);

    const handleOpen = () => {
        cancelScheduledRefresh();
        setHasChanges(false);
        preloadPinnedPostsPanel();
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setIsModalOpen(false);
        if (hasChanges && !isRefreshingRef.current) {
            setHasChanges(false);
            isRefreshingRef.current = true;
            refreshTimeoutRef.current = window.setTimeout(() => {
                refreshTimeoutRef.current = null;
                void refreshPartialElement({
                    selector: FEATURED_POSTS_SELECTOR,
                    url: partialUrl
                }).finally(() => {
                    isRefreshingRef.current = false;
                });
            }, MODAL_CLOSE_REFRESH_DELAY_MS);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={handleOpen}
                onFocus={preloadPinnedPostsPanel}
                onPointerEnter={preloadPinnedPostsPanel}
                className="inline-flex w-fit items-center justify-center rounded-lg bg-surface-subtle px-4 py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-surface-subtle/80 hover:text-content">
                <i className="fas fa-thumbtack mr-2 text-xs" />
                <Trans id="author.pinned_posts.action">Manage pinned posts</Trans>
            </button>

            <Modal
                isOpen={isModalOpen}
                onClose={handleClose}
                title={t({
                    id: 'author.pinned_posts.modal_title',
                    message: 'Manage pinned posts'
                })}
                maxWidth="3xl">
                <Modal.Body className="h-[70vh] overflow-y-auto">
                    <Suspense
                        fallback={
                            <div className="flex h-full min-h-48 items-center justify-center text-content-secondary">
                                <i className="fas fa-spinner fa-spin mr-2" />
                                <Trans id="author.pinned_posts.loading">Loading pinned posts...</Trans>
                            </div>
                        }>
                        <PinnedPostsPanel
                            embedded
                            onPinnedPostsChange={() => setHasChanges(true)}
                        />
                    </Suspense>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default PinnedPostQuickAction;
