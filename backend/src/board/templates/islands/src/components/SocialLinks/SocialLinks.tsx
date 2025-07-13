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

interface SocialLink {
    id: number;
    name: string;
    value: string;
    order: number;
    prepare?: boolean;
}

interface SocialLinksProps {
    social: SocialLink[];
}

interface SocialLinkItemProps {
    social: SocialLink;
    index: number;
    onRemove: (id: number) => void;
    onChange: (index: number, field: 'name' | 'value', value: string) => void;
}

const getIconClassName = (name: string) => {
    const iconMap: Record<string, string> = {
        github: 'fa-brands fa-github',
        twitter: 'fa-brands fa-twitter',
        facebook: 'fa-brands fa-facebook',
        telegram: 'fa-brands fa-telegram',
        instagram: 'fa-brands fa-instagram',
        linkedin: 'fa-brands fa-linkedin',
        youtube: 'fa-brands fa-youtube',
        other: 'fa-solid fa-globe'
    };
    return iconMap[name] || 'fa-solid fa-globe';
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
        <div ref={setNodeRef} style={style} className="social-item">
            <div className="social-item-content">
                <div className="drag-handle" {...attributes} {...listeners}>
                    <i className="fas fa-bars" />
                </div>

                <div className="social-icon">
                    <i className={getIconClassName(social.name)} />
                </div>

                <div className="social-select">
                    <select
                        className="form-select"
                        defaultValue={social.name}
                        onChange={(e) => onChange(index, 'name', e.target.value)}>
                        <option disabled value="">아이콘</option>
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

                <div className="social-input">
                    <input
                        type="url"
                        placeholder="주소"
                        className="form-control"
                        defaultValue={social.value}
                        onChange={(e) => onChange(index, 'value', e.target.value)}
                    />
                </div>

                <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => onRemove(social.id)}>
                    <i className="fas fa-times" />
                </button>
            </div>
        </div>
    );
};

const SocialLinks: React.FC<SocialLinksProps> = ({ social: initialSocial }) => {
    const [socials, setSocials] = useState<SocialLink[]>(
        initialSocial.map(social => ({
            ...social,
            prepare: false
        }))
    );
    const [isLoading, setIsLoading] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setSocials((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over.id);

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

    const handleSocialRemove = async (id: number) => {
        const targetSocial = socials.find(social => social.id === id);

        if (targetSocial?.prepare) {
            setSocials(socials.filter(social => social.id !== id));
            return;
        }

        try {
            const { data } = await http(`v1/setting/social/${id}`, { method: 'DELETE' });

            if (data.status === 'DONE') {
                setSocials(socials.filter(social => social.id !== id));
                notification('소셜 링크가 삭제되었습니다.', { type: 'success' });
            } else {
                notification(data.message || '소셜 링크 삭제에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('소셜 링크 삭제에 실패했습니다.', { type: 'error' });
        }
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

            const { data } = await http('v1/setting/social', {
                method: 'PUT',
                data: {
                    update: updateItems.map((item) => `${item.id},${item.name},${item.value},${item.order}`).join('&'),
                    create: createItems.map((item) => `${item.name},${item.value},${item.order}`).join('&')
                }
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
        <div>
            <form onSubmit={handleSubmit}>
                <div className="social-links-container">
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

                <div className="actions">
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleSocialAdd}>
                        <i className="fas fa-plus" /> 링크 추가
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading}>
                        {isLoading ? '저장 중...' : '저장'}
                    </button>
                </div>
            </form>

            <style jsx>{`
                .social-links-container {
                    margin-bottom: 20px;
                }

                .social-item {
                    margin-bottom: 10px;
                }

                .social-item-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px;
                    background-color: #f8f9fa;
                    border-radius: 4px;
                }

                .drag-handle {
                    cursor: grab;
                    color: #6c757d;
                    width: 20px;
                    text-align: center;
                }

                .social-icon {
                    width: 20px;
                    text-align: center;
                }

                .social-select {
                    width: 120px;
                }

                .social-input {
                    flex-grow: 1;
                }

                .btn-icon {
                    padding: 8px;
                    background: none;
                    border: none;
                    color: #dc3545;
                    cursor: pointer;
                }

                .actions {
                    display: flex;
                    gap: 10px;
                    justify-content: space-between;
                }
            `}</style>
        </div>
    );
};

export default SocialLinks;
