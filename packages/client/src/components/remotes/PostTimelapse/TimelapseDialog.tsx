import { useRef, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLingui } from '@lingui/react/macro';
import { Button } from '~/ui/button';
import { Dialog } from '~/ui/dialog';
import { ENTRANCE_DURATION } from '~/ui/design-tokens';
import { cx } from '~/lib/classnames';
import { getPostTimelapse } from '~/lib/api/posts';
import TimelapsePlayer from './TimelapsePlayer';

interface TimelapseDialogProps {
    username: string;
    postUrl: string;
    returnFocusRef: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
}

const TimelapseDialog = ({ username, postUrl, returnFocusRef, onClose }: TimelapseDialogProps) => {
    const { t } = useLingui();
    const scrollerRef = useRef<HTMLDivElement>(null);
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: ['post-timelapse', username, postUrl],
        queryFn: async () => {
            const { data: response } = await getPostTimelapse(username, postUrl);
            if (response.status === 'ERROR') {
                throw new Error(response.errorMessage);
            }
            return response.body;
        },
        // Every save of the post is in this payload; always load fresh and never keep it in sessionStorage.
        staleTime: 0,
        gcTime: 0,
        retry: false,
        refetchOnWindowFocus: false,
        meta: { persist: false }
    });

    return (
        <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
            <Dialog.Portal>
                <Dialog.Content
                    ref={scrollerRef}
                    aria-describedby={undefined}
                    onCloseAutoFocus={(event) => {
                        const trigger = returnFocusRef.current;
                        if (!trigger?.isConnected) return;
                        event.preventDefault();
                        trigger.focus({ preventScroll: true });
                    }}
                    className={cx(
                        'fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-surface-page focus:outline-none',
                        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
                        `${ENTRANCE_DURATION} ease-out`
                    )}>
                    <Dialog.Title className="sr-only">
                        {t({
                            id: 'post_timelapse.title',
                            message: 'How this post was written'
                        })}
                    </Dialog.Title>
                    {data ? (
                        <TimelapsePlayer timelapse={data} scrollerRef={scrollerRef} onClose={onClose} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
                            {isPending && (
                                <p role="status" className="flex items-center gap-2 text-sm font-medium text-content-secondary">
                                    <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-line-strong border-t-action motion-reduce:animate-none" />
                                    {t({
                                        id: 'post_timelapse.loading',
                                        message: 'Loading the saved versions…'
                                    })}
                                </p>
                            )}
                            {isError && (
                                <>
                                    <p role="alert" className="text-sm text-content-secondary">
                                        {t({
                                            id: 'post_timelapse.error.load',
                                            message: 'Could not load how this post was written.'
                                        })}
                                    </p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="secondary" onClick={() => void refetch()}>
                                            {t({
                                                id: 'post_timelapse.retry',
                                                message: 'Try again'
                                            })}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={onClose}>
                                            {t({
                                                id: 'post_timelapse.close',
                                                message: 'Close'
                                            })}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

export default TimelapseDialog;
