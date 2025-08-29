import React, { useState, useEffect, useRef } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import MarkdownEditor from '../MarkdownEditor/MarkdownEditor';

interface PostData {
    id?: number;
    title: string;
    url: string;
    content: {
        text_md: string;
    };
    meta_description: string;
    image?: {
        url: string;
    };
    tags: {
        all: string[];
    };
    series?: {
        id: string;
        name: string;
    };
    config: {
        hide: boolean;
        notice: boolean;
        advertise: boolean;
    };
}

interface Series {
    id: string;
    name: string;
}

interface TempPostData {
    token: string;
    title: string;
    text_md: string;
    tags: string;
    meta_description?: string;
    url?: string;
    series?: string;
    hide?: boolean;
    notice?: boolean;
    advertise?: boolean;
}

type EditorMode = 'new' | 'edit' | 'temp';

interface PostEditorProps {
    mode: EditorMode;
    username?: string;
    postUrl?: string;
    tempToken?: string;
}

const PostEditor: React.FC<PostEditorProps> = ({
    mode,
    username,
    postUrl,
    tempToken
}) => {
    const [isLoading, setIsLoading] = useState(true);
    const [post, setPost] = useState<PostData | null>(null);
    const [tempPost, setTempPost] = useState<TempPostData | null>(null);
    const [seriesList, setSeriesList] = useState<Series[]>([]);
    
    const [formData, setFormData] = useState({
        title: '',
        url: '',
        content: '',
        metaDescription: '',
        hide: false,
        notice: false,
        advertise: false
    });
    
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedSeries, setSelectedSeries] = useState({
        id: '',
        name: ''
    });
    const [isSeriesDropdownOpen, setIsSeriesDropdownOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    
    const imageInputRef = useRef<HTMLInputElement>(null);
    const autoSaveRef = useRef<number>();
    const formRef = useRef<HTMLFormElement>(null);

    // Get CSRF token from DOM
    const getCsrfToken = () => {
        const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement;
        return tokenElement ? tokenElement.value : '';
    };

    // Fetch data based on mode
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Always fetch series list
                const { data: seriesResponse } = await http('v1/series');
                if (seriesResponse.status === 'DONE') {
                    setSeriesList(seriesResponse.body.series || []);
                }

                if (mode === 'edit' && username && postUrl) {
                    // Fetch post data for editing
                    const { data: postResponse } = await http(`v1/posts/${username}/${postUrl}`);
                    if (postResponse.status === 'DONE') {
                        const postData = postResponse.body;
                        setPost(postData);
                        setFormData({
                            title: postData.title || '',
                            url: postData.url || '',
                            content: postData.content?.text_md || '',
                            metaDescription: postData.meta_description || '',
                            hide: postData.config?.hide || false,
                            notice: postData.config?.notice || false,
                            advertise: postData.config?.advertise || false
                        });
                        setTags(postData.tags?.all?.filter((tag: string) => tag.trim() !== '') || []);
                        setImagePreview(postData.image?.url || null);
                        setSelectedSeries({
                            id: postData.series?.id || '',
                            name: postData.series?.name || ''
                        });
                    }
                } else if (mode === 'temp' && tempToken) {
                    // Fetch temp post data
                    const { data: tempResponse } = await http(`v1/temp-posts/${tempToken}`);
                    if (tempResponse.status === 'DONE') {
                        const tempData = tempResponse.body;
                        setTempPost(tempData);
                        setFormData({
                            title: tempData.title || '',
                            url: tempData.url || '',
                            content: tempData.text_md || '',
                            metaDescription: tempData.meta_description || '',
                            hide: tempData.hide || false,
                            notice: tempData.notice || false,
                            advertise: tempData.advertise || false
                        });
                        const tempTags = tempData.tags ? tempData.tags.split(',').filter((tag: string) => tag.trim() !== '') : [];
                        setTags(tempTags);
                        if (tempData.series) {
                            const series = seriesList.find(s => s.id === tempData.series);
                            if (series) {
                                setSelectedSeries(series);
                            }
                        }
                    }
                }
            } catch (error) {
                notification('데이터를 불러오는데 실패했습니다.', { type: 'error' });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [mode, username, postUrl, tempToken]);

    const handleAutoSave = React.useCallback(async () => {
        if (isSaving || isSubmitting || mode === 'edit') return;

        setIsSaving(true);
        try {
            const tempData = {
                title: formData.title || '제목 없음',
                content: formData.content,
                tags: tags,
                meta_description: formData.metaDescription,
                url: formData.url,
                series: selectedSeries.id || '',
                hide: formData.hide,
                notice: formData.notice,
                advertise: formData.advertise
            };

            const response = await http('v1/temp-posts', {
                method: 'POST',
                data: tempData,
                headers: {
                    'X-CSRFToken': getCsrfToken(),
                    'Content-Type': 'application/json'
                }
            });

            if (response.data?.status === 'DONE') {
                setLastSaved(new Date());
            }
        } catch (_error) {
            // Auto-save failure is not critical
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, isSubmitting, mode, formData, tags, selectedSeries]);

    // Auto-save functionality
    useEffect(() => {
        if (autoSaveRef.current) {
            clearTimeout(autoSaveRef.current);
        }

        autoSaveRef.current = window.setTimeout(() => {
            if (mode === 'new' && (formData.title || formData.content)) {
                handleAutoSave();
            }
        }, 30000); // Auto-save every 30 seconds

        return () => {
            if (autoSaveRef.current) {
                clearTimeout(autoSaveRef.current);
            }
        };
    }, [mode, formData, tags, selectedSeries, handleAutoSave]);

    const handleManualSave = async () => {
        if (!formData.title.trim()) {
            notification('제목을 입력해주세요.', { type: 'error' });
            return;
        }

        await handleAutoSave();
        notification('임시저장되었습니다.', { type: 'success' });
    };

    const generateUrlFromTitle = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 50);
    };

    const handleTitleChange = (title: string) => {
        setFormData(prev => ({
            ...prev,
            title
        }));
        
        if (mode === 'new' && title) {
            setFormData(prev => ({
                ...prev,
                url: generateUrlFromTitle(title)
            }));
        }
    };

    const handleUrlChange = (url: string) => {
        const cleanUrl = url
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s-]/g, '')
            .replace(/\s+/g, '-');
        
        setFormData(prev => ({
            ...prev,
            url: cleanUrl
        }));
    };

    const handleAddTag = () => {
        const tag = newTag.trim();
        if (tag && !tags.includes(tag)) {
            setTags(prev => [...prev, tag]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (index: number) => {
        setTags(prev => prev.filter((_, i) => i !== index));
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setImagePreview(e.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveImage = () => {
        setImagePreview(null);
        if (imageInputRef.current) {
            imageInputRef.current.value = '';
        }
    };

    const handleSeriesSelect = (series: Series | null) => {
        setSelectedSeries({
            id: series?.id || '',
            name: series?.name || ''
        });
        setIsSeriesDropdownOpen(false);
    };

    const validateForm = () => {
        if (!formData.title.trim()) {
            notification('제목을 입력해주세요.', { type: 'error' });
            return false;
        }
        
        if (mode === 'new' && !formData.url.trim()) {
            notification('URL 주소를 입력해주세요.', { type: 'error' });
            return false;
        }
        
        return true;
    };

    const handleSubmit = async (isDraft = false) => {
        if (!validateForm()) return;
        
        setIsSubmitting(true);
        try {
            const form = formRef.current;
            if (!form) return;

            // Add hidden fields for React data
            const addHiddenField = (name: string, value: string) => {
                let field = form.querySelector(`input[name="${name}"]`) as HTMLInputElement;
                if (!field) {
                    field = document.createElement('input');
                    field.type = 'hidden';
                    field.name = name;
                    form.appendChild(field);
                }
                field.value = value;
            };

            addHiddenField('tags', tags.join(','));
            addHiddenField('series', selectedSeries.id);
            addHiddenField('text_md', formData.content);
            
            if (isDraft) {
                addHiddenField('is_draft', 'true');
            }

            if (tempToken) {
                addHiddenField('temp_token', tempToken);
            }

            form.submit();
        } catch (_error) {
            notification('게시글 저장에 실패했습니다.', { type: 'error' });
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('정말로 이 게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            return;
        }

        setIsSubmitting(true);
        try {
            const form = formRef.current;
            if (!form) return;

            const deleteField = document.createElement('input');
            deleteField.type = 'hidden';
            deleteField.name = 'delete';
            deleteField.value = 'true';
            form.appendChild(deleteField);

            form.submit();
        } catch (_error) {
            notification('게시글 삭제에 실패했습니다.', { type: 'error' });
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="bg-slate-50 py-4 sm:py-8">
                <div className="max-w-7xl w-full mx-auto">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <div className="animate-pulse space-y-4">
                            <div className="h-8 bg-slate-200 rounded w-1/3" />
                            <div className="h-4 bg-slate-200 rounded w-2/3" />
                            <div className="h-32 bg-slate-200 rounded" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const isEdit = mode === 'edit';

    return (
        <div className="bg-slate-50 py-4 sm:py-8">
            <div className="max-w-7xl w-full mx-auto">
                {/* Header */}
                <header className="bg-white rounded-xl shadow-sm border border-slate-200 mb-6 sm:mb-8 p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
                            {isEdit ? '게시글 수정' : mode === 'temp' ? '임시저장 게시글 작성' : '새 게시글 작성'}
                        </h1>
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                            {/* Auto-save status */}
                            {(isSaving || lastSaved) && (
                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                    {isSaving ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                                            <span>저장 중...</span>
                                        </>
                                    ) : lastSaved ? (
                                        <>
                                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>
                                                {lastSaved.toLocaleTimeString('ko-KR', {
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })} 자동저장됨
                                            </span>
                                        </>
                                    ) : null}
                                </div>
                            )}
                            
                            {!isEdit && (
                                <button
                                    type="button"
                                    onClick={handleManualSave}
                                    disabled={isSubmitting || isSaving}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all duration-200 w-full sm:w-auto disabled:opacity-50"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                    임시저장
                                </button>
                            )}
                            
                            <button
                                type="button"
                                onClick={() => handleSubmit()}
                                disabled={isSubmitting || isSaving}
                                className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 shadow-sm w-full sm:w-auto disabled:opacity-50"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                                {isEdit ? '수정' : '게시'}
                            </button>
                        </div>
                    </div>
                </header>

                <form ref={formRef} method="POST" encType="multipart/form-data" className="space-y-6 sm:space-y-8">
                    <input type="hidden" name="csrfmiddlewaretoken" value={getCsrfToken()} />
                    
                    {/* Title */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                        <label htmlFor="title" className="block text-sm font-semibold text-slate-700 mb-2">제목</label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={(e) => handleTitleChange(e.target.value)}
                            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-solid border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base sm:text-lg placeholder-slate-400"
                            placeholder="게시글 제목을 입력하세요..."
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
                        {/* Main Editor */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                                <label htmlFor="content" className="block text-sm font-semibold text-slate-700 mb-4">내용</label>
                                <MarkdownEditor
                                    name="text_md"
                                    content={formData.content}
                                    onChange={(value) => setFormData(prev => ({
                                        ...prev,
                                        content: value
                                    }))}
                                />
                            </div>
                        </div>
                        
                        {/* Sidebar */}
                        <div className="lg:col-span-1 space-y-6">
                            {/* URL */}
                            {!isEdit && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                                    <label htmlFor="url" className="block text-sm font-semibold text-slate-700 mb-2">URL 주소</label>
                                    <input
                                        type="text"
                                        id="url"
                                        name="url"
                                        value={formData.url}
                                        onChange={(e) => handleUrlChange(e.target.value)}
                                        className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-solid border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                        placeholder="게시글-url-주소"
                                        required
                                    />
                                    <small className="text-slate-500 mt-2 block">URL이 중복되면 자동으로 번호가 추가됩니다.</small>
                                </div>
                            )}

                            {/* Cover Image */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-4">커버 이미지</label>
                                
                                <div className="space-y-4">
                                    <label className="flex items-center justify-center gap-2 sm:gap-3 w-full px-3 sm:px-4 py-2 sm:py-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all duration-200">
                                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                        </svg>
                                        <span className="text-slate-600 font-medium text-sm sm:text-base">이미지 업로드</span>
                                        <input
                                            ref={imageInputRef}
                                            type="file"
                                            id="image"
                                            name="image"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleImageUpload}
                                        />
                                    </label>
                                    
                                    {imagePreview && (
                                        <div className="relative">
                                            <img src={imagePreview} alt="Cover Image" className="w-full h-32 sm:h-48 object-cover rounded-lg" />
                                            <button
                                                type="button"
                                                onClick={handleRemoveImage}
                                                className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Meta Description */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                                <label htmlFor="meta_description" className="block text-sm font-semibold text-slate-700 mb-2">메타 설명</label>
                                <textarea
                                    id="meta_description"
                                    name="meta_description"
                                    value={formData.metaDescription}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        metaDescription: e.target.value
                                    }))}
                                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-solid border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm sm:text-base"
                                    rows={3}
                                    maxLength={150}
                                    placeholder="SEO를 위한 간단한 설명..."
                                />
                                <div className="flex justify-between items-center mt-2">
                                    <small className="text-slate-500">검색엔진을 위한 SEO 설명</small>
                                    <small className="text-slate-400">{formData.metaDescription.length}/150</small>
                                </div>
                            </div>

                            {/* Tags */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-4">태그</label>
                                
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newTag}
                                            onChange={(e) => {
                                                const value = e.target.value
                                                    .toLowerCase()
                                                    .replace(/[^a-z0-9가-힣\s]/g, '')
                                                    .replace(/\s+/g, '-');
                                                setNewTag(value);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddTag();
                                                }
                                            }}
                                            className="flex-1 w-full px-3 py-2 border border-solid border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                            placeholder="태그 입력..."
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddTag}
                                            disabled={!newTag.trim()}
                                            className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm sm:text-base"
                                        >
                                            추가
                                        </button>
                                    </div>
                                    
                                    {tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map((tag, index) => (
                                                <span key={tag} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                                    <span>{tag}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTag(index)}
                                                        className="w-4 h-4 hover:bg-blue-200 rounded-full flex items-center justify-center"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                        </svg>
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Series */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                                <label className="block text-sm font-semibold text-slate-700 mb-4">시리즈</label>
                                
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsSeriesDropdownOpen(!isSeriesDropdownOpen)}
                                        className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border border-solid border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                                    >
                                        <span className="text-slate-700">
                                            {selectedSeries.name || '시리즈 선택'}
                                        </span>
                                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${isSeriesDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </button>
                                    
                                    {isSeriesDropdownOpen && (
                                        <div className="absolute z-10 w-full mt-2 bg-white border border-slate-300 rounded-lg shadow-lg max-h-48 sm:max-h-64 overflow-y-auto">
                                            <div
                                                onClick={() => handleSeriesSelect(null)}
                                                className="px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 text-sm sm:text-base"
                                            >
                                                없음
                                            </div>
                                            {seriesList.map((series) => (
                                                <div
                                                    key={series.id}
                                                    onClick={() => handleSeriesSelect(series)}
                                                    className={`px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0 text-sm sm:text-base ${
                                                        selectedSeries.id === series.id ? 'bg-blue-50 text-blue-700' : ''
                                                    }`}
                                                >
                                                    {series.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Post Settings */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
                                <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-slate-700 mb-4">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    게시글 설정
                                </h3>
                                
                                <div className="space-y-4">
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            id="hide"
                                            name="hide"
                                            checked={formData.hide}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                hide: e.target.checked
                                            }))}
                                            className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-700 group-hover:text-slate-900 text-sm sm:text-base">비공개</div>
                                            <div className="text-xs sm:text-sm text-slate-500">본인만 볼 수 있습니다</div>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            id="notice"
                                            name="notice"
                                            checked={formData.notice}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                notice: e.target.checked
                                            }))}
                                            className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-700 group-hover:text-slate-900 text-sm sm:text-base">공지사항으로 고정</div>
                                            <div className="text-xs sm:text-sm text-slate-500">블로그 상단에 고정됩니다</div>
                                        </div>
                                    </label>
                                    
                                    <label className="flex items-start gap-3 cursor-pointer group">
                                        <input
                                            type="checkbox"
                                            id="advertise"
                                            name="advertise"
                                            checked={formData.advertise}
                                            onChange={(e) => setFormData(prev => ({
                                                ...prev,
                                                advertise: e.target.checked
                                            }))}
                                            className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 mt-0.5"
                                        />
                                        <div>
                                            <div className="font-medium text-slate-700 group-hover:text-slate-900 text-sm sm:text-base">광고 표시</div>
                                            <div className="text-xs sm:text-sm text-slate-500">이 게시글에 광고를 표시합니다</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            {isEdit && (
                                <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
                                    <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-red-700 mb-4">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                        위험 구역
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleDelete}
                                        disabled={isSubmitting}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 sm:py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm sm:text-base disabled:opacity-50"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        게시글 삭제
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PostEditor;