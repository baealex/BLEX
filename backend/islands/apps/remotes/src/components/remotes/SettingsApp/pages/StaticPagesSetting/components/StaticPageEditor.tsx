import { useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useBlocker } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from '~/utils/toast';
import { useConfirm } from '~/hooks/useConfirm';
import {
    Button,
    Input,
    TiptapEditor,
    api,
    DIM_OVERLAY_DEFAULT,
    ENTRANCE_DURATION
} from '~/components/shared';
import { Dialog } from '@blex/ui/dialog';
import { FloatingBottomBar } from '@blex/ui/floating-bottom-bar';
import { IconButton } from '@blex/ui/icon-button';
import { Toggle } from '@blex/ui/toggle';
import {
    Search,
    Send,
    Settings2,
    SlidersHorizontal,
    X
} from '@blex/ui/icons';
import { cx } from '~/lib/classnames';
import {
    getStaticPage,
    createStaticPage,
    updateStaticPage,
    deleteStaticPage,
    type StaticPageCreateData
} from '~/lib/api/settings';

const toSlug = (text: string, trim = false) => {
    let result = text
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    if (trim) {
        result = result.replace(/^-|-$/g, '');
    }
    return result;
};

interface StaticPageEditorProps {
    pageId?: number;
}

const StaticPageEditor = ({ pageId }: StaticPageEditorProps) => {
    const isEditMode = pageId !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();
    const isDirtyRef = useRef(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const { data: page } = useSuspenseQuery({
        queryKey: ['static-page', pageId],
        queryFn: async () => {
            if (!pageId) return null;
            const { data } = await getStaticPage(pageId);
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('정적 페이지를 불러오는데 실패했습니다.');
        }
    });

    const [title, setTitle] = useState(page?.title ?? '');
    const [slug, setSlug] = useState(page?.slug ?? '');
    const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!page);
    const [content, setContent] = useState(page?.content ?? '');
    const [metaDescription, setMetaDescription] = useState(page?.metaDescription ?? '');
    const [isPublished, setIsPublished] = useState(page?.isPublished ?? true);
    const [showInFooter, setShowInFooter] = useState(page?.showInFooter ?? false);
    const [order, setOrder] = useState(page?.order ?? 0);
    const pageUrlPath = `/static/${slug || 'slug'}`;

    const markDirty = () => {
        isDirtyRef.current = true;
    };

    useBlocker({
        shouldBlockFn: async () => {
            if (!isDirtyRef.current) return false;
            const confirmed = await confirm({
                title: '저장하지 않은 변경사항',
                message: '변경사항이 저장되지 않았습니다. 페이지를 나가시겠습니까?',
                confirmText: '나가기',
                variant: 'danger'
            });
            return !confirmed;
        },
        enableBeforeUnload: () => isDirtyRef.current
    });

    const handleTitleChange = (value: string) => {
        setTitle(value);
        markDirty();
        if (!slugManuallyEdited) {
            setSlug(toSlug(value));
        }
    };

    const handleSlugChange = (value: string) => {
        setSlugManuallyEdited(true);
        setSlug(toSlug(value));
        markDirty();
    };

    const handleContentChange = (value: string) => {
        setContent(value);
        markDirty();
    };

    const handlePublishedChange = (checked: boolean) => {
        setIsPublished(checked);
        markDirty();
    };

    const handleShowInFooterChange = (checked: boolean) => {
        setShowInFooter(checked);
        markDirty();
    };

    const handleImageUpload = useCallback(async (file: File) => {
        try {
            const { data } = await api.uploadImage(file);
            if (data.status === 'DONE') {
                return data.body.url;
            }
        } catch {
            toast.error('이미지 업로드에 실패했습니다.');
        }
        return undefined;
    }, []);

    const createMutation = useMutation({
        mutationFn: (pageData: StaticPageCreateData) => createStaticPage(pageData),
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '정적 페이지 생성에 실패했습니다.');
                return;
            }
            isDirtyRef.current = false;
            toast.success('정적 페이지가 생성되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['static-pages'] });
            navigate({ to: '/static-pages' });
        },
        onError: () => {
            toast.error('정적 페이지 생성에 실패했습니다.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: (pageData: StaticPageCreateData) => {
            if (!pageId) throw new Error('pageId is required');
            return updateStaticPage(pageId, pageData);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '정적 페이지 수정에 실패했습니다.');
                return;
            }
            isDirtyRef.current = false;
            toast.success('정적 페이지가 수정되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['static-pages'] });
            navigate({ to: '/static-pages' });
        },
        onError: () => {
            toast.error('정적 페이지 수정에 실패했습니다.');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: () => {
            if (!pageId) throw new Error('pageId is required');
            return deleteStaticPage(pageId);
        },
        onSuccess: ({ data }) => {
            if (data.status === 'ERROR') {
                toast.error(data.errorMessage || '정적 페이지 삭제에 실패했습니다.');
                return;
            }
            isDirtyRef.current = false;
            toast.success('정적 페이지가 삭제되었습니다.');
            queryClient.invalidateQueries({ queryKey: ['static-pages'] });
            navigate({ to: '/static-pages' });
        },
        onError: () => {
            toast.error('정적 페이지 삭제에 실패했습니다.');
        }
    });

    const isLoading = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = () => {
        if (!title.trim()) {
            toast.error('제목을 입력해주세요.');
            return;
        }
        if (!slug.trim()) {
            toast.error('URL 슬러그를 입력해주세요.');
            return;
        }

        const pageData: StaticPageCreateData = {
            title: title.trim(),
            slug: toSlug(slug, true),
            content,
            meta_description: metaDescription.trim(),
            is_published: isPublished,
            show_in_footer: showInFooter,
            order
        };

        if (isEditMode) {
            updateMutation.mutate(pageData);
        } else {
            createMutation.mutate(pageData);
        }
    };

    const handleDelete = async () => {
        const confirmed = await confirm({
            title: '정적 페이지 삭제',
            message: `"${title}" 페이지를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`,
            confirmText: '삭제',
            variant: 'danger'
        });

        if (!confirmed) {
            return;
        }

        deleteMutation.mutate();
    };

    return (
        <div className="min-h-screen bg-surface pb-16">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-surface border-b border-line">
                <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">
                    <Link
                        to="/static-pages"
                        className="flex items-center gap-2 text-sm text-content-secondary hover:text-content transition-colors">
                        <i className="fas fa-arrow-left" />
                        <span>목록으로</span>
                    </Link>
                    {isEditMode && slug ? (
                        <a
                            href={pageUrlPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-content-secondary hover:text-content transition-colors">
                            <span>{pageUrlPath}</span>
                            <i className="fas fa-external-link-alt text-xs" />
                        </a>
                    ) : (
                        <div />
                    )}
                </div>
            </div>

            {!isEditMode && (
                <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-4">
                    <div className="rounded-2xl border border-warning-line bg-warning-surface px-4 py-3">
                        <p className="text-sm font-extrabold text-warning sm:text-base">
                            페이지 이름과 URL을 정한 뒤, 아래 에디터에서 본문을 바로 작성하세요.
                        </p>
                        <p className="mt-1 text-xs font-medium text-warning">
                            이 화면은 정적 페이지를 빠르게 만드는 용도입니다.
                        </p>
                    </div>
                </div>
            )}

            <div className={`max-w-7xl mx-auto px-4 md:px-6 pb-6 ${isEditMode ? 'pt-8' : ''}`}>
                <div className="rounded-2xl border border-line bg-surface p-4 md:p-5">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Input
                                label="페이지 이름"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="예: 이용약관, 개인정보처리방침"
                            />
                            <p className="text-xs text-content-hint">
                                브라우저 탭 제목과 푸터 링크에 사용됩니다. 본문 제목은 에디터에서 작성하세요.
                            </p>
                        </div>

                        <div>
                            <Input
                                label="URL 슬러그"
                                value={slug}
                                onChange={(e) => handleSlugChange(e.target.value)}
                                placeholder="page-url-slug"
                            />
                            <p className="mt-2 text-xs text-content-hint">{pageUrlPath}</p>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-line bg-surface-subtle p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-content">공개</p>
                                    <p className="text-xs text-content-secondary">페이지를 공개합니다</p>
                                </div>
                                <Toggle
                                    checked={isPublished}
                                    onCheckedChange={handlePublishedChange}
                                    aria-label="공개"
                                />
                            </div>
                        </div>

                        <div className="rounded-xl border border-line bg-surface-subtle p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-content">푸터에 표시</p>
                                    <p className="text-xs text-content-secondary">사이트 하단 메뉴에 노출</p>
                                </div>
                                <Toggle
                                    checked={showInFooter}
                                    onCheckedChange={handleShowInFooterChange}
                                    aria-label="푸터에 표시"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Editor*/}
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-6">
                <TiptapEditor
                    name="static-page-content"
                    content={content}
                    onChange={handleContentChange}
                    onImageUpload={handleImageUpload}
                />
            </div>

            <FloatingBottomBar>
                {isEditMode && (
                    <>
                        <Button
                            type="button"
                            variant="ghost"
                            size="md"
                            isLoading={deleteMutation.isPending}
                            disabled={isLoading}
                            onClick={handleDelete}
                            className="!rounded-full !text-danger hover:!text-danger hover:!bg-danger-surface">
                            삭제
                        </Button>
                        <div className="w-px h-8 bg-line/60 mx-1" />
                    </>
                )}

                <IconButton
                    onClick={() => setIsSettingsOpen(true)}
                    rounded="full"
                    aria-label="페이지 설정"
                    title="페이지 설정">
                    <SlidersHorizontal className="w-5 h-5" />
                </IconButton>

                <div className="w-px h-8 bg-line/60 mx-1" />

                <Button
                    onClick={handleSubmit}
                    disabled={isLoading || deleteMutation.isPending}
                    variant="primary"
                    className="!rounded-full"
                    leftIcon={!isLoading ? <Send className="w-4 h-4" /> : undefined}
                    isLoading={isLoading}>
                    {isLoading ? '저장 중...' : isEditMode ? '수정' : '생성'}
                </Button>
            </FloatingBottomBar>

            {/* Settings Drawer */}
            <Dialog.Root open={isSettingsOpen} onOpenChange={(open) => !open && setIsSettingsOpen(false)}>
                <Dialog.Portal>
                    <Dialog.Overlay className={`fixed inset-0 ${DIM_OVERLAY_DEFAULT} z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`} />
                    <Dialog.Content
                        className={cx(
                            'fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-surface shadow-2xl flex flex-col focus:outline-none',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
                            `${ENTRANCE_DURATION} ease-in-out`
                        )}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-line">
                            <div className="flex items-center gap-3">
                                <SlidersHorizontal className="w-5 h-5 text-content-hint" />
                                <Dialog.Title className="text-lg font-semibold text-content">페이지 설정</Dialog.Title>
                            </div>
                            <Dialog.Close asChild>
                                <IconButton aria-label="닫기">
                                    <X className="w-5 h-5" />
                                </IconButton>
                            </Dialog.Close>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-6">
                            <div className="space-y-8">
                                {/* SEO Section */}
                                <div>
                                    <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                        <Search className="w-4 h-4" />
                                        검색 노출
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <Input
                                                label="메타 설명"
                                                multiline
                                                rows={3}
                                                value={metaDescription}
                                                onChange={(e) => {
                                                    setMetaDescription(e.target.value);
                                                    markDirty();
                                                }}
                                                placeholder="검색 엔진에 표시될 설명 (160자 이내)"
                                                maxLength={160}
                                            />
                                            <div className="flex items-center justify-between mt-2">
                                                <p className="text-xs text-content-hint">검색 결과에 표시되는 설명입니다</p>
                                                <p className={`text-xs font-medium ${metaDescription.length > 140 ? 'text-danger' : 'text-content-hint'}`}>
                                                    {metaDescription.length}/160
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-line" />

                                {/* Page Settings */}
                                <div>
                                    <h3 className="text-sm font-semibold text-content mb-4 flex items-center gap-2">
                                        <Settings2 className="w-4 h-4" />
                                        고급 설정
                                    </h3>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between py-3">
                                            <div className="flex items-center gap-3">
                                                <Settings2 className="w-4 h-4 text-content-hint" />
                                                <div>
                                                    <div className="text-sm font-medium text-content">순서</div>
                                                    <div className="text-xs text-content-secondary">푸터 메뉴에서의 표시 순서</div>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                value={order}
                                                onChange={(e) => {
                                                    setOrder(parseInt(e.target.value) || 0);
                                                    markDirty();
                                                }}
                                                className="w-16 text-right text-sm border border-line rounded-lg px-2 py-1.5 outline-none focus:border-line-strong"
                                            />
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-line bg-surface-subtle">
                            <Button
                                type="button"
                                onClick={() => setIsSettingsOpen(false)}
                                variant="primary"
                                size="md"
                                fullWidth>
                                완료
                            </Button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </div>
    );
};

export default StaticPageEditor;
