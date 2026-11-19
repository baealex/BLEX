import { useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Copy } from '@blex/ui/icons';

import { Button, Input, Modal } from '~/components/shared';
import { createPostShareLink, getPostShareLinks, updatePostShareLink, type PostShareLink } from '~/lib/api/posts';
import { toast } from '~/utils/toast';

interface PostShareLinksDialogProps {
    username: string;
    postUrl: string;
    postTitle: string;
    onClose: () => void;
}

type LinkChange =
    | { type: 'create'; label: string }
    | { type: 'rename'; linkId: number; label: string }
    | { type: 'pause'; linkId: number; isPaused: boolean };

const LABEL_LIMIT = 100;

export const PostShareLinksDialog = ({ username, postUrl, postTitle, onClose }: PostShareLinksDialogProps) => {
    const { i18n, t } = useLingui();
    const queryClient = useQueryClient();
    const queryKey = ['post-share-links', username, postUrl];
    const [editingLinkId, setEditingLinkId] = useState<number | null>(null);
    const {
        register,
        handleSubmit,
        reset,
        setFocus,
        formState: { errors }
    } = useForm<{ label: string }>({ defaultValues: { label: '' } });

    const shareLinks = useQuery({
        queryKey,
        queryFn: async ({ signal }) => {
            const { data } = await getPostShareLinks(username, postUrl, signal);
            if (data.status === 'ERROR') {
                throw new Error(data.errorMessage);
            }
            return data.body;
        }
    });

    const linkMutation = useMutation({
        mutationFn: async (change: LinkChange) => {
            const { data } = change.type === 'create'
                ? await createPostShareLink(username, postUrl, change.label)
                : await updatePostShareLink(username, postUrl, change.linkId, change.type === 'rename'
                    ? { label: change.label }
                    : { is_paused: change.isPaused });
            return data;
        },
        onSuccess: async (data, change) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || t({
                    id: 'settings.posts.share_links.save_failed',
                    message: 'Could not save the share link.'
                }));
                return;
            }
            if (change.type !== 'pause') {
                setEditingLinkId(null);
                reset({ label: '' });
            }
            await queryClient.invalidateQueries({ queryKey });
        },
        onError: () => toast.error(t({
            id: 'settings.posts.share_links.save_failed',
            message: 'Could not save the share link.'
        }))
    });

    useEffect(() => {
        if (editingLinkId !== null) {
            setFocus('label');
        }
    }, [editingLinkId, setFocus]);

    const handleRename = (link: PostShareLink) => {
        reset({ label: link.label });
        setEditingLinkId(link.id);
        if (editingLinkId === link.id) setFocus('label');
    };

    const handleCopy = async (url: string) => {
        try {
            await navigator.clipboard.writeText(url);
            toast.success(t({
                id: 'settings.posts.share_links.copied',
                message: 'Share link copied.'
            }));
        } catch {
            toast.error(t({
                id: 'settings.posts.share_links.copy_failed',
                message: 'Could not copy the link. Select the address to copy it.'
            }));
        }
    };

    const handleSave = handleSubmit(({ label }) => {
        if (editingLinkId === null) {
            linkMutation.mutate({
                type: 'create',
                label: label.trim()
            });
        } else {
            linkMutation.mutate({
                type: 'rename',
                linkId: editingLinkId,
                label: label.trim()
            });
        }
    });

    return (
        <Modal
            isOpen
            onClose={onClose}
            title={t({
                id: 'settings.posts.share_links.title',
                message: 'Share links'
            })}
            maxWidth="lg">
            <Modal.Body className="space-y-5">
                <div>
                    <p className="break-words font-medium text-content">{postTitle}</p>
                    <p className="mt-1 text-sm text-content-secondary">
                        <Trans id="settings.posts.share_links.description">
                            Create a link for each place you share this post. Click counts are estimates.
                        </Trans>
                    </p>
                </div>

                {shareLinks.isPending && (
                    <p role="status" className="text-sm text-content-secondary">
                        <Trans id="common.loading">Loading</Trans>
                    </p>
                )}
                {shareLinks.isError && (
                    <div className="space-y-2">
                        <p role="alert" className="text-sm text-danger">
                            <Trans id="settings.posts.share_links.load_failed">Could not load share links.</Trans>
                        </p>
                        <Button density="compact" size="sm" variant="secondary" onClick={() => void shareLinks.refetch()}>
                            <Trans id="common.retry">Try again</Trans>
                        </Button>
                    </div>
                )}
                {shareLinks.data && (
                    <>
                        {!shareLinks.data.canCreate && (
                            <p className="text-sm text-content-secondary">
                                <Trans id="settings.posts.share_links.public_post_required">
                                    Publish this post publicly to create links or open existing ones.
                                </Trans>
                            </p>
                        )}
                        {(shareLinks.data.canCreate || editingLinkId !== null) && (
                            <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
                                <Input
                                    className="min-w-[12rem] grow"
                                    label={t({
                                        id: 'settings.posts.share_links.name',
                                        message: 'Link name'
                                    })}
                                    placeholder={t({
                                        id: 'settings.posts.share_links.name_placeholder',
                                        message: 'e.g. November newsletter'
                                    })}
                                    maxLength={LABEL_LIMIT}
                                    error={errors.label?.message}
                                    disabled={linkMutation.isPending}
                                    {...register('label', {
                                        validate: (label) => Boolean(label.trim()) || t({
                                            id: 'settings.posts.share_links.name_required',
                                            message: 'Enter a link name.'
                                        })
                                    })}
                                />
                                <Button
                                    type="submit"
                                    density="compact"
                                    size="lg"
                                    disabled={linkMutation.isPending}
                                    isLoading={linkMutation.isPending && linkMutation.variables?.type !== 'pause'}>
                                    {editingLinkId === null
                                        ? <Trans id="settings.posts.share_links.create">Create link</Trans>
                                        : <Trans id="common.save">Save</Trans>}
                                </Button>
                                {editingLinkId !== null && (
                                    <Button
                                        density="compact"
                                        variant="ghost"
                                        disabled={linkMutation.isPending}
                                        onClick={() => {
                                            setEditingLinkId(null);
                                            reset({ label: '' });
                                        }}>
                                        <Trans id="common.cancel">Cancel</Trans>
                                    </Button>
                                )}
                            </form>
                        )}
                        {shareLinks.data.links.length === 0 ? (
                            <p className="text-sm text-content-hint">
                                <Trans id="settings.posts.share_links.empty">No share links yet.</Trans>
                            </p>
                        ) : (
                            <ul className="space-y-3">
                                {shareLinks.data.links.map((link) => (
                                    <li key={link.id} className="space-y-2 rounded-xl border border-line bg-surface px-4 py-3">
                                        <div className="flex items-baseline justify-between gap-3">
                                            <p className="min-w-0 break-words font-medium text-content">{link.label}</p>
                                            {link.isPaused && (
                                                <span className="shrink-0 text-xs text-content-secondary">
                                                    <Trans id="settings.posts.share_links.paused">Paused</Trans>
                                                </span>
                                            )}
                                        </div>
                                        <p dir="ltr" className="select-all break-all text-xs text-content-secondary">{link.url}</p>
                                        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
                                            <div className="flex gap-2">
                                                <dt className="text-content-secondary"><Trans id="settings.posts.share_links.recent">Last 7 days</Trans></dt>
                                                <dd className="font-medium text-content">{i18n.number(link.recentClicks)}</dd>
                                            </div>
                                            <div className="flex gap-2">
                                                <dt className="text-content-secondary">
                                                    <Trans id="settings.posts.share_links.total">Total estimated clicks</Trans>
                                                </dt>
                                                <dd className="font-medium text-content">{i18n.number(link.totalClicks)}</dd>
                                            </div>
                                        </dl>
                                        <div className="flex flex-wrap gap-1">
                                            <Button
                                                size="sm"
                                                density="compact"
                                                variant="secondary"
                                                leftIcon={<Copy aria-hidden className="h-4 w-4" />}
                                                disabled={link.isPaused || !shareLinks.data.canCreate}
                                                onClick={() => void handleCopy(link.url)}>
                                                <Trans id="settings.posts.share_links.copy">Copy link</Trans>
                                            </Button>
                                            <Button
                                                size="sm"
                                                density="compact"
                                                variant="ghost"
                                                disabled={linkMutation.isPending}
                                                onClick={() => handleRename(link)}>
                                                <Trans id="settings.posts.share_links.rename">Rename</Trans>
                                            </Button>
                                            <Button
                                                size="sm"
                                                density="compact"
                                                variant="ghost"
                                                disabled={linkMutation.isPending}
                                                onClick={() => linkMutation.mutate({
                                                    type: 'pause',
                                                    linkId: link.id,
                                                    isPaused: !link.isPaused
                                                })}>
                                                {link.isPaused
                                                    ? <Trans id="settings.posts.share_links.resume">Resume</Trans>
                                                    : <Trans id="settings.posts.share_links.pause">Pause</Trans>}
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </Modal.Body>
        </Modal>
    );
};
