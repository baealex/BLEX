import { useSortable } from '@dnd-kit/sortable';
import {
    TITLE,
    SUBTITLE,
    Dropdown,
    getIconClass
} from '~/components/shared';
import { SettingsListItem } from '../../../components';
import { getMediaPath } from '~/modules/static.module';
import { useConfirm } from '~/hooks/useConfirm';
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
    const { confirm } = useConfirm();
    const {
        attributes,
        listeners,
        setNodeRef,
        transition,
        isDragging
    } = useSortable({ id: pinnedPost.post.url });

    const style = {
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    const handleView = () => {
        window.location.assign(`/@${username}/${pinnedPost.post.url}`);
    };

    const handleRemove = async () => {
        const confirmed = await confirm({
            title: '포스트 고정 해제',
            message: `"${pinnedPost.post.title}" 포스트 고정을 해제하시겠습니까?`,
            confirmText: '해제',
            variant: 'danger'
        });

        if (confirmed) {
            onRemove(pinnedPost.post.url);
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <SettingsListItem
                onClick={handleView}
                dragHandleProps={{
                    attributes,
                    listeners
                }}
                left={
                    pinnedPost.post.image ? (
                        <div className={`${getIconClass('default')} overflow-hidden`}>
                            <img
                                src={getMediaPath(pinnedPost.post.image)}
                                alt={pinnedPost.post.title}
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className={getIconClass('default')}>
                            <i className="fas fa-thumbtack text-sm" />
                        </div>
                    )
                }
                actions={
                    <Dropdown
                        items={[
                            {
                                label: '고정 해제',
                                icon: 'fas fa-thumbtack',
                                onClick: handleRemove
                            }
                        ]}
                    />
                }>
                <h3 className={`${TITLE} mb-1 truncate text-gray-900`}>{pinnedPost.post.title}</h3>
                <div className={`${SUBTITLE} text-xs flex items-center gap-2`}>
                    <span className="flex items-center gap-1">
                        <i className="far fa-calendar text-gray-400" />
                        {new Date(pinnedPost.post.createdDate).toLocaleDateString('ko-KR')}
                    </span>
                </div>
            </SettingsListItem>
        </div>
    );
};
