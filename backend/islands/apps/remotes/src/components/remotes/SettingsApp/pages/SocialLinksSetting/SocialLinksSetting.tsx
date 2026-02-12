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
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader } from '../../components';
import { Button, Input, Dropdown } from '~/components/shared';
import { baseInputStyles } from '~/components/shared';
import { getSocialLinks, updateSocialLinks, type SocialLink as ApiSocialLink } from '~/lib/api/settings';

interface SocialLink extends ApiSocialLink {
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

    const platformOptions = [
        {
            label: '아이콘 선택',
            value: ''
        },
        {
            label: '깃허브',
            value: 'github'
        },
        {
            label: '트위터',
            value: 'twitter'
        },
        {
            label: '페이스북',
            value: 'facebook'
        },
        {
            label: '텔레그램',
            value: 'telegram'
        },
        {
            label: '인스타그램',
            value: 'instagram'
        },
        {
            label: '링크드인',
            value: 'linkedin'
        },
        {
            label: '유튜브',
            value: 'youtube'
        },
        {
            label: '기타',
            value: 'other'
        }
    ];

    const currentPlatform = platformOptions.find(opt => opt.value === social.name);

    return (
        <div ref={setNodeRef} style={style} className="mb-4">
            <div className="bg-white border border-gray-200 rounded-2xl transition-all duration-300 group overflow-hidden">
                {/* 헤더 영역 - 모든 화면 크기에서 표시 */}
                <div className="flex items-center justify-between p-4 sm:hidden bg-gray-50 border-b border-gray-200/60">
                    <div className="flex items-center gap-3">
                        <div
                            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center transition-colors touch-none hover:bg-gray-100 rounded-lg"
                            style={{ touchAction: 'none' }}
                            {...attributes}
                            {...listeners}>
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
                            </svg>
                        </div>
                        <div className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm">
                            <i className={`${getIconClassName(social.name)} text-gray-600 text-sm`} />
                        </div>
                        <span className="text-sm font-medium text-gray-700">소셜 링크</span>
                    </div>
                    <button
                        type="button"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-200"
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
                        className="hidden sm:flex cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 w-8 h-8 items-center justify-center transition-colors group-hover:text-gray-500 hover:bg-gray-100 rounded-lg flex-shrink-0"
                        style={{ touchAction: 'none' }}
                        {...attributes}
                        {...listeners}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
                        </svg>
                    </div>

                    {/* 아이콘 - 데스크톱에서만 표시 */}
                    <div className="hidden sm:flex w-10 h-10 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg shadow-sm group-hover:from-gray-50 group-hover:to-gray-100 transition-all duration-200 flex-shrink-0">
                        <i className={`${getIconClassName(social.name)} text-gray-600 text-lg group-hover:text-gray-600`} />
                    </div>

                    {/* 플랫폼 선택 */}
                    <div className="w-full sm:w-44 flex-shrink-0">
                        <label className="block text-xs font-medium text-gray-600 mb-2 sm:hidden">플랫폼 선택</label>
                        <Dropdown
                            trigger={
                                <button type="button" className={`${baseInputStyles} flex items-center justify-between`}>
                                    <span className={!social.name ? 'text-gray-400' : 'text-gray-900'}>
                                        {currentPlatform?.label || '아이콘 선택'}
                                    </span>
                                    <i className="fas fa-chevron-down text-gray-400 text-xs" />
                                </button>
                            }
                            items={platformOptions.map(opt => ({
                                label: opt.label,
                                onClick: () => onChange(index, 'name', opt.value),
                                checked: social.name === opt.value
                            }))}
                            align="start"
                        />
                    </div>

                    {/* 링크 주소 */}
                    <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-2 sm:hidden">링크 주소</label>
                        <Input
                            type="url"
                            placeholder="https://example.com"
                            value={social.value}
                            onChange={(e) => onChange(index, 'value', e.target.value)}
                        />
                    </div>

                    {/* 삭제 버튼 - 데스크톱에서만 표시 */}
                    <button
                        type="button"
                        className="hidden sm:flex w-10 h-10 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all duration-200 group/btn flex-shrink-0"
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

    const { data: socialData } = useSuspenseQuery({
        queryKey: ['social-links-setting'],
        queryFn: async () => {
            const { data } = await getSocialLinks();
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
                toast.error('소셜 아이콘을 모두 선택해주세요.');
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => !social.value)) {
                toast.error('소셜 주소를 모두 입력해주세요.');
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => !social.value.startsWith('https://'))) {
                toast.error('소셜 주소는 https:// 로 시작해야 합니다.');
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => social.value.includes(',') || social.value.includes('&'))) {
                toast.error('소셜 주소에는 , 와 & 를 포함할 수 없습니다.');
                setIsLoading(false);
                return;
            }

            const updateItems = socials.filter((social) => !social.prepare);
            const createItems = socials.filter((social) => social.prepare);

            // 삭제된 아이템들 찾기
            const deletedItems = originalSocials.filter(
                (original) => !socials.some((current) => current.id === original.id)
            );

            const { data } = await updateSocialLinks({
                update: updateItems.map((item) => `${item.id},${item.name},${item.value},${item.order}`).join('&'),
                create: createItems.map((item) => `${item.name},${item.value},${item.order}`).join('&'),
                delete: deletedItems.map((item) => item.id).join('&')
            });

            if (data.status === 'DONE') {
                toast.success('소셜 정보가 업데이트 되었습니다.');
                const updatedSocials = (data.body as SocialLink[]).map((social) => ({
                    ...social,
                    prepare: false
                }));
                setSocials(updatedSocials);
                setOriginalSocials(updatedSocials);
            } else {
                toast.error('소셜 정보 업데이트에 실패했습니다.');
            }
        } catch {
            toast.error('소셜 정보 업데이트에 실패했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <SettingsHeader
                title="소셜 링크"
                description="프로필에 표시될 소셜 미디어 링크를 추가하고 순서를 조정하세요."
            />

            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    {socials.length === 0 ? (
                        <div className="py-16 text-center border border-dashed border-gray-200 rounded-2xl">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-50 mb-4">
                                <i className="fas fa-share-alt text-2xl text-gray-300" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">소셜 링크가 없습니다</h3>
                            <p className="text-gray-500 text-sm mb-6">첫 번째 소셜 링크를 추가해보세요.</p>
                            <Button type="button" variant="secondary" size="md" onClick={handleSocialAdd}>
                                소셜 링크 추가하기
                            </Button>
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
                    <div className="flex flex-col sm:flex-row gap-3 sm:justify-between border-t border-gray-200 pt-6">
                        <Button
                            type="button"
                            variant="secondary"
                            size="md"
                            leftIcon={<i className="fas fa-plus" />}
                            onClick={handleSocialAdd}
                            className="sm:w-auto">
                            링크 추가
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            size="md"
                            isLoading={isLoading}
                            leftIcon={!isLoading ? <i className="fas fa-save" /> : undefined}
                            className="sm:w-auto">
                            {isLoading ? '저장 중...' : '변경사항 저장'}
                        </Button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default SocialLinks;
