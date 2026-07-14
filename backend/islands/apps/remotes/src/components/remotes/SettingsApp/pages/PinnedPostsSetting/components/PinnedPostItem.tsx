import { useSortable } from '@dnd-kit/sortable';
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
                    ariaLabel: `${pinnedPost.post.title} 고정 포스트 순서 변경`
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
                        variant="secondary"
                        size="sm"
                        className="min-h-11!"
                        onClick={handleRemove}>
                        해제
                    </Button>
                }>
                <h3 className={`${SETTINGS_LIST_TITLE} mb-1 truncate text-content`}>{pinnedPost.post.title}</h3>
                <div className={`${SETTINGS_LIST_META} text-xs flex items-center gap-2`}>
                    <span className="flex items-center gap-1">
                        <Calendar aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                        {new Date(pinnedPost.post.createdDate).toLocaleDateString('ko-KR')}
                    </span>
                </div>
            </SettingsListItem>
        </div>
    );
};
