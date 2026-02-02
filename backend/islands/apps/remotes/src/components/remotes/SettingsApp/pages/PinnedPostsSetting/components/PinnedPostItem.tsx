import { useSortable } from '@dnd-kit/sortable';
import {
    getCardClass,
    CARD_PADDING,
    FLEX_ROW,
    TITLE,
    SUBTITLE,
    ACTIONS_CONTAINER,
    DRAG_HANDLE,
    Dropdown
} from '~/components/shared';
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
            title: '고정 해제',
            message: `"${pinnedPost.post.title}" 글의 고정을 해제하시겠습니까?`,
            confirmText: '해제',
            variant: 'danger'
        });

        if (confirmed) {
            onRemove(pinnedPost.post.url);
        }
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-3">
            <div className={getCardClass('cursor-pointer bg-white hover:bg-gray-50/50 transition-colors')} onClick={handleView}>
                <div className={CARD_PADDING}>
                    <div className={FLEX_ROW}>
                        {/* Drag handle */}
                        <div
                            className={`${DRAG_HANDLE} hover:bg-gray-100 rounded-lg transition-colors p-1`}
                            style={{ touchAction: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                            {...attributes}
                            {...listeners}>
                            <i className="fas fa-grip-vertical text-gray-400" />
                        </div>

                        {/* Icon or Image */}
                        {pinnedPost.post.image ? (
                            <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 mr-4 shadow-sm border border-gray-100">
                                <img
                                    src={getMediaPath(pinnedPost.post.image)}
                                    alt={pinnedPost.post.title}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 mr-4 border border-gray-100">
                                <i className="fas fa-thumbtack text-gray-400" />
                            </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <h3 className={`${TITLE} mb-1 truncate text-gray-900`}>{pinnedPost.post.title}</h3>
                            <div className={`${SUBTITLE} text-xs flex items-center gap-2`}>
                                <span className="flex items-center gap-1">
                                    <i className="far fa-calendar text-gray-400" />
                                    {new Date(pinnedPost.post.createdDate).toLocaleDateString('ko-KR')}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className={ACTIONS_CONTAINER} onClick={(e) => e.stopPropagation()}>
                            <Dropdown
                                items={[
                                    {
                                        label: '글 보기',
                                        icon: 'fas fa-eye',
                                        onClick: handleView
                                    },
                                    {
                                        label: '고정 해제',
                                        icon: 'fas fa-thumbtack',
                                        onClick: handleRemove
                                    }
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
