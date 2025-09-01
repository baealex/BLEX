import { useState, useEffect } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    TouchSensor
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';

import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';

interface SocialLink {
    id: number;
    name: string;
    value: string;
    order: number;
    prepare?: boolean;
}

interface SocialLinkItemProps {
    social: SocialLink;
    index: number;
    onRemove: (id: number) => void;
    onChange: (index: number, field: 'name' | 'value', value: string) => void;
}

const getIconClassName = (name: string) => {
    const iconMap: Record<string, string> = {
        github: 'fab fa-github',
        twitter: 'fab fa-twitter',
        facebook: 'fab fa-facebook-f',
        telegram: 'fab fa-telegram',
        instagram: 'fab fa-instagram',
        linkedin: 'fab fa-linkedin-in',
        youtube: 'fab fa-youtube',
        other: 'fas fa-link'
    };
    return iconMap[name] || 'fas fa-link';
};

const SocialLinkItem = ({ social, index, onRemove, onChange }: SocialLinkItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id: social.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-4">
            <div className="bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-200/60 transition-all duration-200 group overflow-hidden">
                {/* 헤더 영역 - 모든 화면 크기에서 표시 */}
                <div className="flex items-center justify-between p-4 sm:hidden bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/60">
                    <div className="flex items-center gap-3">
                        <div
                            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center transition-colors touch-none hover:bg-slate-100 rounded-lg"
                            style={{ touchAction: 'none' }}
                            {...attributes}
                            {...listeners}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
                            </svg>
                        </div>
                        <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm">
                            <i className={`${getIconClassName(social.name)} text-slate-600 text-sm`} />
                        </div>
                        <span className="text-sm font-medium text-slate-700">소셜 링크</span>
                    </div>
                    <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
                        onClick={() => onRemove(social.id)}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>

                {/* 메인 컨텐츠 영역 */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3">
                    {/* 드래그 핸들 - 데스크톱에서만 표시 */}
                    <div
                        className="hidden sm:flex cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 w-8 h-8 items-center justify-center transition-colors group-hover:text-indigo-500 hover:bg-slate-100 rounded-lg flex-shrink-0"
                        style={{ touchAction: 'none' }}
                        {...attributes}
                        {...listeners}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
                        </svg>
                    </div>

                    {/* 아이콘 - 데스크톱에서만 표시 */}
                    <div className="hidden sm:flex w-10 h-10 items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg shadow-sm group-hover:from-indigo-50 group-hover:to-indigo-100 transition-all duration-200 flex-shrink-0">
                        <i className={`${getIconClassName(social.name)} text-slate-600 text-lg group-hover:text-indigo-600`} />
                    </div>

                    {/* 플랫폼 선택 */}
                    <div className="w-full sm:w-44 flex-shrink-0">
                        <label className="block text-xs font-medium text-slate-600 mb-2 sm:hidden">플랫폼 선택</label>
                        <select
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 focus:ring-offset-0 text-sm p-3 transition-all duration-200 bg-slate-50/50 hover:bg-white"
                            value={social.name}
                            onChange={(e) => onChange(index, 'name', e.target.value)}>
                            <option disabled value="">아이콘 선택</option>
                            <option value="github">깃허브</option>
                            <option value="twitter">트위터</option>
                            <option value="facebook">페이스북</option>
                            <option value="telegram">텔레그램</option>
                            <option value="instagram">인스타그램</option>
                            <option value="linkedin">링크드인</option>
                            <option value="youtube">유튜브</option>
                            <option value="other">기타</option>
                        </select>
                    </div>

                    {/* 링크 주소 */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-600 mb-2 sm:hidden">링크 주소</label>
                        <input
                            type="url"
                            placeholder="https://example.com"
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 focus:ring-offset-0 text-sm p-3 transition-all duration-200 bg-slate-50/50 hover:bg-white"
                            value={social.value}
                            onChange={(e) => onChange(index, 'value', e.target.value)}
                        />
                    </div>

                    {/* 삭제 버튼 - 데스크톱에서만 표시 */}
                    <button
                        type="button"
                        className="hidden sm:flex w-10 h-10 items-center justify-center rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 group/btn flex-shrink-0"
                        onClick={() => onRemove(social.id)}>
                        <svg className="w-4 h-4 group-hover/btn:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

const SocialLinks = () => {
    const [socials, setSocials] = useState<SocialLink[]>([]);
    const [originalSocials, setOriginalSocials] = useState<SocialLink[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const { data: socialData, isError } = useFetch({
        queryKey: ['social-links-setting'],
        queryFn: async () => {
            const { data } = await http('v1/setting/profile', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body.social || [];
            }
            throw new Error('소셜 링크 정보를 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (socialData) {
            const mappedSocials = socialData.map((social: SocialLink) => ({
                ...social,
                prepare: false
            }));
            setSocials(mappedSocials);
            setOriginalSocials(mappedSocials);
        }
    }, [socialData]);

    useEffect(() => {
        if (isError) {
            notification('소셜 링크 정보를 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5
            }
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setSocials((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over?.id);

                const newItems = arrayMove(items, oldIndex, newIndex);
                return newItems.map((item, index) => ({
                    ...item,
                    order: index + 1
                }));
            });
        }
    };

    const handleSocialChange = (index: number, field: 'name' | 'value', value: string) => {
        setSocials(prev => {
            const newSocials = [...prev];
            newSocials[index][field] = value;
            return newSocials;
        });
    };

    const handleSocialAdd = () => {
        setSocials([...socials, {
            id: Math.random(),
            name: '',
            value: '',
            order: socials.length + 1,
            prepare: true
        }]);
    };

    const handleSocialRemove = (id: number) => {
        setSocials(socials.filter(social => social.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (socials.some((social) => !social.name)) {
                notification('소셜 아이콘을 모두 선택해주세요.', { type: 'error' });
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => !social.value)) {
                notification('소셜 주소를 모두 입력해주세요.', { type: 'error' });
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => !social.value.startsWith('https://'))) {
                notification('소셜 주소는 https:// 로 시작해야 합니다.', { type: 'error' });
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => social.value.includes(',') || social.value.includes('&'))) {
                notification('소셜 주소에는 , 와 & 를 포함할 수 없습니다.', { type: 'error' });
                setIsLoading(false);
                return;
            }

            const updateItems = socials.filter((social) => !social.prepare);
            const createItems = socials.filter((social) => social.prepare);

            // 삭제된 아이템들 찾기
            const deletedItems = originalSocials.filter(
                (original) => !socials.some((current) => current.id === original.id)
            );

            const params = new URLSearchParams();
            params.append('update', updateItems.map((item) => `${item.id},${item.name},${item.value},${item.order}`).join('&'));
            params.append('create', createItems.map((item) => `${item.name},${item.value},${item.order}`).join('&'));
            params.append('delete', deletedItems.map((item) => item.id).join('&'));

            const { data } = await http('v1/setting/social', {
                method: 'PUT',
                data: params.toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (data.status === 'DONE') {
                notification('소셜 정보가 업데이트 되었습니다.', { type: 'success' });
                const updatedSocials = (data.body as SocialLink[]).map((social) => ({
                    ...social,
                    prepare: false
                }));
                setSocials(updatedSocials);
                setOriginalSocials(updatedSocials);
            } else {
                notification('소셜 정보 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('소셜 정보 업데이트에 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl">
            {/* 헤더 섹션 */}
            <div className="mb-6">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/60 rounded-xl p-4 sm:p-6">
                    <h2 className="text-lg sm:text-xl font-bold text-indigo-900 mb-2 flex items-center">
                        <i className="fas fa-share-alt mr-3 text-indigo-700" />
                        소셜 링크 설정
                    </h2>
                    <p className="text-indigo-700 text-sm">프로필에 표시될 소셜 미디어 링크를 추가하고 순서를 조정하세요.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    {socials.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                                <i className="fas fa-share-alt text-slate-400 text-2xl" />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 mb-2">소셜 링크가 없습니다</h3>
                            <p className="text-slate-500 mb-4">첫 번째 소셜 링크를 추가해보세요!</p>
                            <button
                                type="button"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md"
                                onClick={handleSocialAdd}>
                                <i className="fas fa-plus text-sm" />
                                첫 링크 추가하기
                            </button>
                        </div>
                    ) : (
                        <DndContext
                            sensors={sensors}
                            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}>
                            <SortableContext
                                items={socials.map(social => social.id)}
                                strategy={verticalListSortingStrategy}>
                                {socials.map((social, index) => (
                                    <SocialLinkItem
                                        key={social.id}
                                        social={social}
                                        index={index}
                                        onRemove={handleSocialRemove}
                                        onChange={handleSocialChange}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {socials.length > 0 && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:justify-between border-t border-slate-200 pt-6">
                        <button
                            type="button"
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200"
                            onClick={handleSocialAdd}>
                            <i className="fas fa-plus text-xs" />
                            링크 추가
                        </button>
                        <button
                            type="submit"
                            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                            disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    저장 중...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-save text-xs" />
                                    변경사항 저장
                                </>
                            )}
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default SocialLinks;
