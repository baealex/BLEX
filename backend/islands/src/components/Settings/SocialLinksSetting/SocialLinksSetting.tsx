import React, { useState } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
            <div className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                <div
                    className="cursor-grab text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center transition-colors"
                    {...attributes}
                    {...listeners}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
                    </svg>
                </div>

                <div className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full">
                    <i className={`${getIconClassName(social.name)} text-gray-600`} />
                </div>

                <div className="w-40">
                    <select
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 transition-colors"
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

                <div className="flex-1">
                    <input
                        type="url"
                        placeholder="https://example.com"
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 transition-colors"
                        value={social.value}
                        onChange={(e) => onChange(index, 'value', e.target.value)}
                    />
                </div>

                <button
                    type="button"
                    className="w-8 h-8 flex items-center justify-center rounded-full text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors"
                    onClick={() => onRemove(social.id)}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

const SocialLinks: React.FC = () => {
    const [socials, setSocials] = useState<SocialLink[]>([]);
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

    React.useEffect(() => {
        if (socialData) {
            setSocials(socialData.map((social: SocialLink) => ({
                ...social,
                prepare: false
            })));
        }
    }, [socialData]);

    React.useEffect(() => {
        if (isError) {
            notification('소셜 링크 정보를 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const sensors = useSensors(
        useSensor(PointerSensor),
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

            const params = new URLSearchParams();
            params.append('update', updateItems.map((item) => `${item.id},${item.name},${item.value},${item.order}`).join('&'));
            params.append('create', createItems.map((item) => `${item.name},${item.value},${item.order}`).join('&'));

            const { data } = await http('v1/setting/social', {
                method: 'PUT',
                data: params.toString(),
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (data.status === 'DONE') {
                notification('소셜 정보가 업데이트 되었습니다.', { type: 'success' });
                setSocials((data.body as SocialLink[]).map((social) => ({
                    ...social,
                    prepare: false
                })));
            } else {
                notification('소셜 정보 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('소셜 정보 업데이트에 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 bg-white shadow-md rounded-lg">
            <form onSubmit={handleSubmit}>
                <div className="mb-5">
                    <DndContext
                        sensors={sensors}
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
                </div>

                <div className="flex gap-2 justify-between mt-4">
                    <button
                        type="button"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                        onClick={handleSocialAdd}>
                        <i className="fas fa-plus" /> 링크 추가
                    </button>
                    <button
                        type="submit"
                        className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading}>
                        {isLoading ? '저장 중...' : '저장'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SocialLinks;
