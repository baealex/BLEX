import { Select } from '@blex/ui';
import { Button, Input, Dropdown, Alert } from '~/components/shared';
import { getIconClass } from '~/components/shared';
import type { Post } from '../hooks';
import type { Series } from '~/lib/api/settings';

interface PostCardProps {
    post: Post;
    username: string;
    series?: Series[];
    onVisibilityToggle: (postUrl: string) => void;
    onNoticeToggle: (postUrl: string) => void;
    onDelete: (postUrl: string) => void;
    onTagChange: (postUrl: string, value: string) => void;
    onTagSubmit: (postUrl: string) => void;
    onSeriesChange: (postUrl: string, value: string) => void;
    onSeriesSubmit: (postUrl: string) => void;
}

const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
};

const PostCard = ({
    post,
    username,
    series,
    onVisibilityToggle,
    onNoticeToggle,
    onDelete,
    onTagChange,
    onTagSubmit,
    onSeriesChange,
    onSeriesSubmit
}: PostCardProps) => {
    return (
        <div className="bg-white border border-gray-100 rounded-2xl hover:border-gray-200 transition-all duration-200 overflow-hidden">
            {/* 헤더 */}
            <div
                className="p-5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => window.location.assign(`/@${username}/${post.url}/edit`)}>
                <div className="flex items-start justify-between gap-4 mb-3">
                    {/* 제목 영역 */}
                    <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 mb-2 break-words leading-tight">
                            {post.title}
                        </h3>
                        <div className="flex items-center gap-3 text-sm text-gray-500 flex-wrap">
                            <span className="flex items-center">
                                <i className="fas fa-calendar mr-1.5" />
                                {formatDate(post.createdDate)}
                            </span>
                            {post.createdDate !== post.updatedDate && (
                                <>
                                    <span className="text-gray-400">•</span>
                                    <span>수정됨</span>
                                </>
                            )}
                            <span className="text-gray-400">•</span>
                            <span className="flex items-center gap-3">
                                <span className="flex items-center">
                                    <i className="fas fa-heart text-red-400 mr-1" />
                                    {post.countLikes}
                                </span>
                                <span className="flex items-center">
                                    <i className="fas fa-comment text-blue-400 mr-1" />
                                    {post.countComments}
                                </span>
                                <span className="flex items-center">
                                    <i className="fas fa-clock text-gray-400 mr-1" />
                                    {post.readTime}분
                                </span>
                            </span>
                            {post.isHide && (
                                <>
                                    <span className="text-gray-400">•</span>
                                    <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                                        <i className="fas fa-lock mr-1.5" />
                                        비공개
                                    </span>
                                </>
                            )}
                            {post.isNotice && (
                                <>
                                    <span className="text-gray-400">•</span>
                                    <span className="inline-flex items-center px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                        <i className="fas fa-bell mr-1.5" />
                                        공지
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* 액션 */}
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                            items={[
                                {
                                    label: '포스트 보기',
                                    icon: 'fas fa-eye',
                                    onClick: () => location.assign(`/@${username}/${post.url}`)
                                },
                                {
                                    label: post.isHide ? '공개로 변경' : '비공개로 변경',
                                    icon: `fas ${post.isHide ? 'fa-eye' : 'fa-eye-slash'}`,
                                    onClick: () => onVisibilityToggle(post.url)
                                },
                                {
                                    label: post.isNotice ? '공지 해제' : '공지로 설정',
                                    icon: `fas ${post.isNotice ? 'fa-bell-slash' : 'fa-bell'}`,
                                    onClick: () => onNoticeToggle(post.url)
                                },
                                {
                                    label: '삭제',
                                    icon: 'fas fa-trash',
                                    onClick: () => onDelete(post.url),
                                    variant: 'danger'
                                }
                            ]}
                        />
                    </div>
                </div>
            </div>

            {/* 편집 영역 */}
            <div className="p-3 space-y-3 bg-gray-50">
                {/* 태그 */}
                <div className="flex items-center gap-3">
                    <div className={getIconClass('light')}>
                        <i className="fas fa-tag text-sm" />
                    </div>
                    <Input
                        type="text"
                        placeholder="태그를 입력하세요..."
                        value={post.tag}
                        onChange={(e) => onTagChange(post.url, e.target.value)}
                        className="flex-1"
                    />
                    {post.hasTagChanged && (
                        <Button
                            variant="primary"
                            size="md"
                            leftIcon={<i className="fas fa-save" />}
                            onClick={() => onTagSubmit(post.url)}>
                            저장
                        </Button>
                    )}
                </div>

                {/* 시리즈 */}
                <div className="flex items-center gap-3">
                    <div className={getIconClass('light')}>
                        <i className="fas fa-book text-sm" />
                    </div>
                    <div className="flex-1">
                        <Select
                            value={post.series || ''}
                            onValueChange={(value) => onSeriesChange(post.url, value)}
                            items={[
                                {
                                    value: '',
                                    label: '시리즈 선택 안함'
                                },
                                ...(series?.map((item) => ({
                                    value: item.url,
                                    label: item.title
                                })) || [])
                            ]}
                            placeholder="시리즈 선택 안함"
                        />
                    </div>
                    {post.hasSeriesChanged && (
                        <Button
                            variant="primary"
                            size="md"
                            leftIcon={<i className="fas fa-save" />}
                            onClick={() => onSeriesSubmit(post.url)}>
                            저장
                        </Button>
                    )}
                </div>

                {post.readTime > 30 && (
                    <Alert variant="warning" title="긴 글 주의">
                        이 글은 읽는데 {post.readTime}분이 걸립니다.
                        내용을 나누어 여러 포스트로 작성하는 것을 고려해보세요.
                    </Alert>
                )}
            </div>
        </div>
    );
};

export default PostCard;
