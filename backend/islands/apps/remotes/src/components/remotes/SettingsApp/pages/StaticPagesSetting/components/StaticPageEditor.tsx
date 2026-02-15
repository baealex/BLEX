import { useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useBlocker } from '@tanstack/react-router';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { toast } from '~/utils/toast';
import { Button, Input, TiptapEditor, api } from '~/components/shared';
import {
    Dialog,
    IconButton,
    Toggle,
    SlidersHorizontal,
    Send,
    X,
    Search,
    Eye,
    EyeOff,
    FileText,
    Settings2,
    Trash2
} from '@blex/ui';
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

export const StaticPageEditor = ({ pageId }: StaticPageEditorProps) => {
    const isEditMode = pageId !== undefined;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
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

    const markDirty = () => {
        isDirtyRef.current = true;
    };

    useBlocker({
        shouldBlockFn: () => isDirtyRef.current,
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

    const handleDelete = () => {
        if (confirm('정말로 이 정적 페이지를 삭제하시겠습니까?')) {
            deleteMutation.mutate();
        }
    };

    return (
        <div className="min-h-screen bg-white">
            {/* Top bar */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between h-14">
                    <Link
                        to="/static-pages"
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
                        <i className="fas fa-arrow-left" />
                        <span>목록으로</span>
                    </Link>
                    {isEditMode && slug ? (
                        <a
                            href={`/static/${slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
                            <span>/static/{slug}</span>
                            <i className="fas fa-external-link-alt text-xs" />
                        </a>
                    ) : (
                        <div />
                    )}
                </div>
            </div>

            {/* Title */}
            <div className="max-w-7xl mx-auto px-4 md:px-6 pt-8 pb-4">
                <input
                    type="text"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="페이지 제목"
                    className="w-full text-3xl font-bold text-gray-900 placeholder-gray-300 border-none outline-none bg-transparent"
                />
            </div>

            {/* Editor*/}
            <div className="max-w-7xl mx-auto px-4 md:px-6 pb-32">
                <TiptapEditor
                    name="static-page-content"
                    content={content}
                    onChange={handleContentChange}
                    height="calc(100vh - 300px)"
                    onImageUpload={handleImageUpload}
                />
            </div>

            {/* Floating bottom bar */}
            <div className="fixed sm:sticky bottom-6 left-0 right-0 z-30 flex justify-center pointer-events-none">
                <div className="pointer-events-auto bg-white/80 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-full px-3 py-3 flex items-center gap-2 transform transition-all duration-300 hover:scale-105 hover:shadow-[0_8px_40px_rgb(0,0,0,0.16)]">
                    {/* Settings */}
                    <IconButton
                        onClick={() => setIsSettingsOpen(true)}
                        rounded="full"
                        aria-label="페이지 설정"
                        title="페이지 설정">
                        <SlidersHorizontal className="w-5 h-5" />
                    </IconButton>

                    <div className="w-px h-8 bg-gray-200/50 mx-1" />

                    {/* Publish status indicator */}
                    <div className="flex items-center gap-1.5 px-1 text-xs text-gray-400">
                        {isPublished ? (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <span>공개</span>
                            </>
                        ) : (
                            <>
                                <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                <span>비공개</span>
                            </>
                        )}
                    </div>

                    {/* Submit */}
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        variant="primary"
                        compact
                        className="!rounded-full"
                        leftIcon={<Send className="w-4 h-4" />}>
                        {isLoading ? '저장 중...' : isEditMode ? '수정' : '생성'}
                    </Button>
                </div>
            </div>

            {/* Settings Drawer */}
            <Dialog.Root open={isSettingsOpen} onOpenChange={(open) => !open && setIsSettingsOpen(false)}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                    <Dialog.Content
                        className={cx(
                            'fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-white shadow-2xl flex flex-col focus:outline-none',
                            'data-[state=open]:animate-in data-[state=closed]:animate-out',
                            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
                            'duration-300 ease-in-out'
                        )}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <SlidersHorizontal className="w-5 h-5 text-gray-400" />
                                <Dialog.Title className="text-lg font-semibold text-gray-900">페이지 설정</Dialog.Title>
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
                                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <Search className="w-4 h-4" />
                                        SEO
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <Input
                                                label="URL 슬러그"
                                                value={slug}
                                                onChange={(e) => handleSlugChange(e.target.value)}
                                                placeholder="page-url-slug"
                                            />
                                            <p className="text-xs text-gray-400 mt-2">/static/{slug || 'slug'}</p>
                                        </div>
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
                                                <p className="text-xs text-gray-400">검색 결과에 표시되는 설명입니다</p>
                                                <p className={`text-xs font-medium ${metaDescription.length > 140 ? 'text-orange-500' : 'text-gray-400'}`}>
                                                    {metaDescription.length}/160
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-200" />

                                {/* Page Settings */}
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        페이지 설정
                                    </h3>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between py-3">
                                            <div className="flex items-center gap-3">
                                                {isPublished
                                                    ? <Eye className="w-4 h-4 text-gray-400" />
                                                    : <EyeOff className="w-4 h-4 text-gray-400" />}
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">공개</div>
                                                    <div className="text-xs text-gray-500">페이지를 공개합니다</div>
                                                </div>
                                            </div>
                                            <Toggle
                                                checked={isPublished}
                                                onCheckedChange={(checked) => {
                                                    setIsPublished(checked);
                                                    markDirty();
                                                }}
                                                aria-label="공개"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between py-3">
                                            <div className="flex items-center gap-3">
                                                <FileText className="w-4 h-4 text-gray-400" />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">푸터에 표시</div>
                                                    <div className="text-xs text-gray-500">사이트 하단에 링크를 표시합니다</div>
                                                </div>
                                            </div>
                                            <Toggle
                                                checked={showInFooter}
                                                onCheckedChange={(checked) => {
                                                    setShowInFooter(checked);
                                                    markDirty();
                                                }}
                                                aria-label="푸터에 표시"
                                            />
                                        </div>

                                        <div className="flex items-center justify-between py-3">
                                            <div className="flex items-center gap-3">
                                                <Settings2 className="w-4 h-4 text-gray-400" />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">순서</div>
                                                    <div className="text-xs text-gray-500">푸터 메뉴에서의 표시 순서</div>
                                                </div>
                                            </div>
                                            <input
                                                type="number"
                                                value={order}
                                                onChange={(e) => {
                                                    setOrder(parseInt(e.target.value) || 0);
                                                    markDirty();
                                                }}
                                                className="w-16 text-right text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-gray-400"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Delete - Edit mode only */}
                                {isEditMode && (
                                    <>
                                        <div className="border-t border-gray-200" />
                                        <div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                compact
                                                onClick={handleDelete}
                                                className="!text-red-500 hover:!text-red-700 hover:!bg-red-50 !px-0"
                                                leftIcon={<Trash2 className="w-4 h-4" />}>
                                                페이지 삭제
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
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
