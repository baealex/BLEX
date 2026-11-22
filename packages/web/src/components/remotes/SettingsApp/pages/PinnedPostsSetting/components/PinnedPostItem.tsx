import { useSortable } from '@dnd-kit/sortable';
import { Trans, useLingui } from '@lingui/react/macro';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Pin } from '@blex/ui/icons';
import { Button } from '~/components/shared';
import {
    getSettingsIconClass,
    SETTINGS_LIST_META,
    SETTINGS_LIST_TITLE
} from '~/styles/settingsStyles';
import { SettingsListItem } from '../../../components';
import { getMediaPath } from '~/modules/static.module';
import type { PinnedPostData } from '~/lib/api/settings';
import { formatPublishedDate } from '~/i18n/formatters';
import { normalizeLocale } from '~/i18n/locale';

interface PinnedPostItemProps {
    pinnedPost: PinnedPostData;
    username: string;
    onRemove: (postUrl: string) => void;
}

export const PinnedPostItem = ({
    pinnedPost,
    username,
    onRemove
}: PinnedPostItemProps) => {
    const { i18n } = useLingui();
    const locale = normalizeLocale(i18n.locale);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: pinnedPost.post.url });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        position: 'relative' as const,
        zIndex: isDragging ? 999 : 1
    };

    const handleView = () => {
        window.location.assign(`/@${username}/${pinnedPost.post.url}`);
    };

    const handleRemove = () => {
        onRemove(pinnedPost.post.url);
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <SettingsListItem
                onClick={handleView}
                dragHandleProps={{
                    attributes,
                    listeners,
                    ariaLabel: i18n._({
                        id: 'settings.pinned_posts.reorder_label',
                        message: 'Reorder pinned post: {title}',
                        values: { title: pinnedPost.post.title }
                    })
                }}
                left={
                    pinnedPost.post.image ? (
                        <div className={`${getSettingsIconClass('default')} overflow-hidden`}>
                            <img
                                src={getMediaPath(pinnedPost.post.image)}
                                alt={pinnedPost.post.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className={getSettingsIconClass('default')}>
                            <Pin aria-hidden className="h-4 w-4" />
                        </div>
                    )
                }
                actions={
                    <Button
                        density="compact"
                        variant="secondary"
                        size="sm"
                        className="min-h-11! [@media(pointer:fine)]:min-h-9!"
                        onClick={handleRemove}>
                        <Trans id="settings.pinned_posts.unpin">Unpin</Trans>
                    </Button>
                }>
                <h3 className={`${SETTINGS_LIST_TITLE} mb-1 truncate text-content`}>{pinnedPost.post.title}</h3>
                <div className={`${SETTINGS_LIST_META} text-xs flex items-center gap-2`}>
                    <span className="flex items-center gap-1">
                        <Calendar aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                        {formatPublishedDate(
                            pinnedPost.post.createdDate,
                            pinnedPost.post.createdDate,
                            locale
                        )}
                    </span>
                </div>
            </SettingsListItem>
        </div>
    );
};
