import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface Series {
    id: number;
    name: string;
    url: string;
    description: string;
    thumbnail: string;
    postCount: number;
}

interface SortableSeriesItemProps {
    series: Series;
    onEdit: (series: Series) => void;
    onDelete: (id: number) => void;
}

const SortableSeriesItem: React.FC<SortableSeriesItemProps> = ({ series, onEdit, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: series.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="series-item">
            <div className="series-drag-handle" {...attributes} {...listeners}>
                <i className="fas fa-bars" />
            </div>
            <div className="series-thumbnail">
                {series.thumbnail ? (
                    <img src={series.thumbnail} alt={series.name} />
                ) : (
                    <div className="thumbnail-placeholder">
                        <i className="fas fa-book" />
                    </div>
                )}
            </div>
            <div className="series-info">
                <h4 className="series-name">{series.name}</h4>
                <p className="series-description">{series.description || '설명 없음'}</p>
                <div className="series-meta">
                    <span className="series-count">
                        <i className="fas fa-file-alt" /> {series.postCount}개의 포스트
                    </span>
                </div>
            </div>
            <div className="series-actions">
                <button
                    type="button"
                    className="btn btn-icon"
                    onClick={() => onEdit(series)}>
                    <i className="fas fa-edit" />
                </button>
                <button
                    type="button"
                    className="btn btn-icon btn-danger"
                    onClick={() => onDelete(series.id)}>
                    <i className="fas fa-trash" />
                </button>
            </div>
        </div>
    );
};

const seriesFormSchema = z.object({
    name: z.string().min(1, '시리즈 이름을 입력해주세요.'),
    url: z.string().min(1, 'URL을 입력해주세요.').regex(/^[a-zA-Z0-9-]+$/, 'URL은 영문, 숫자, 하이픈(-)만 사용할 수 있습니다.'),
    description: z.string().optional(),
    thumbnail: z.string().optional()
});

type SeriesFormInputs = z.infer<typeof seriesFormSchema>;

const SeriesManagement: React.FC = () => {
    const [series, setSeries] = useState<Series[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSeries, setEditingSeries] = useState<Series | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register, handleSubmit, reset, setValue, formState: { errors }, control
    } = useForm<SeriesFormInputs>({ resolver: zodResolver(seriesFormSchema) });

    const thumbnail = useWatch({
        control,
        name: 'thumbnail'
    });

    useEffect(() => {
        const fetchSeries = async () => {
            try {
                const { data } = await http('v1/setting/series', { method: 'GET' });
                if (data.status === 'DONE') {
                    // The API returns 'title' and 'total_posts', not 'name', 'id', 'description', 'thumbnail'
                    // We need to fetch full series details for 'id', 'description', 'thumbnail'
                    // For now, we'll use a placeholder for id and empty for description/thumbnail
                    const fetchedSeries: Series[] = data.body.series.map((item: any) => ({
                        id: item.url.hashCode(), // Using URL as a temporary ID for DND
                        name: item.title,
                        url: item.url,
                        description: '', // Not provided by this API
                        thumbnail: item.image || '', // 'image' is provided, map to 'thumbnail'
                        postCount: item.total_posts
                    }));
                    setSeries(fetchedSeries);
                } else {
                    notification('시리즈 정보를 불러오는데 실패했습니다.', { type: 'error' });
                }
            } catch (error) {
                notification('시리즈 정보를 불러오는데 실패했습니다.', { type: 'error' });
            }
        };
        fetchSeries();
    }, []);

    const handleOpenModal = (seriesItem: Series | null = null) => {
        if (seriesItem) {
            setEditingSeries(seriesItem);
            reset({
                name: seriesItem.name,
                url: seriesItem.url,
                description: seriesItem.description,
                thumbnail: seriesItem.thumbnail
            });
        } else {
            setEditingSeries(null);
            reset({
                name: '',
                url: '',
                description: '',
                thumbnail: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingSeries(null);
        reset(); // Clear form data
    };

    const handleThumbnailChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('thumbnail', file);

        try {
            const { data } = await http('v1/upload/image', {
                method: 'POST',
                data: formData
            });

            if (data.status === 'DONE') {
                setValue('thumbnail', data.body.url); // Set thumbnail URL in react-hook-form
                notification('썸네일이 업로드되었습니다.', { type: 'success' });
            } else {
                notification('썸네일 업로드에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('썸네일 업로드에 실패했습니다.', { type: 'error' });
        }
    };

    const onSubmit = async (formData: SeriesFormInputs) => {
        setIsLoading(true);

        try {
            if (editingSeries) {
                // Update existing series
                const { data } = await http(`v1/series/${editingSeries.id}`, {
                    method: 'PUT',
                    data: {
                        name: formData.name,
                        url: formData.url,
                        description: formData.description,
                        thumbnail: formData.thumbnail
                    }
                });

                if (data.status === 'DONE') {
                    setSeries(prev => prev.map(item =>
                        item.id === editingSeries.id
                            ? {
                                ...item,
                                name: formData.name,
                                url: formData.url,
                                description: formData.description || '',
                                thumbnail: formData.thumbnail || ''
                            }
                            : item
                    ));
                    notification('시리즈가 업데이트 되었습니다.', { type: 'success' });
                    handleCloseModal();
                } else {
                    notification(data.message || '시리즈 업데이트에 실패했습니다.', { type: 'error' });
                }
            } else {
                // Create new series
                const { data } = await http('v1/series', {
                    method: 'POST',
                    data: {
                        name: formData.name,
                        url: formData.url,
                        description: formData.description,
                        thumbnail: formData.thumbnail
                    }
                });

                if (data.status === 'DONE') {
                    setSeries(prev => [...prev, {
                        id: data.body.id,
                        name: data.body.name,
                        url: data.body.url,
                        description: data.body.description || '',
                        thumbnail: data.body.thumbnail || '',
                        postCount: data.body.postCount
                    }]);
                    notification('시리즈가 생성되었습니다.', { type: 'success' });
                    handleCloseModal();
                } else {
                    notification(data.message || '시리즈 생성에 실패했습니다.', { type: 'error' });
                }
            }
        } catch (error) {
            notification('요청 처리에 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('정말로 이 시리즈를 삭제하시겠습니까? 시리즈에 속한 포스트는 삭제되지 않습니다.')) {
            return;
        }

        try {
            const { data } = await http(`v1/series/${id}`, { method: 'DELETE' });

            if (data.status === 'DONE') {
                setSeries(prev => prev.filter(item => item.id !== id));
                notification('시리즈가 삭제되었습니다.', { type: 'success' });
            } else {
                notification(data.message || '시리즈 삭제에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('시리즈 삭제에 실패했습니다.', { type: 'error' });
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setSeries((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);

                const newItems = arrayMove(items, oldIndex, newIndex);

                // Update series order on server
                http('v1/series/order', {
                    method: 'PUT',
                    data: { order: newItems.map((item, idx) => [item.id, idx]) }
                }).catch(() => {
                    notification('시리즈 순서 변경에 실패했습니다.', { type: 'error' });
                });

                return newItems;
            });
        }
    };

    return (
        <div className="series-management">
            <div className="series-header">
                <h3 className="series-title">내 시리즈 ({series.length})</h3>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleOpenModal()}>
                    <i className="fas fa-plus" /> 새 시리즈
                </button>
            </div>

            {series.length === 0 ? (
                <div className="empty-state">
                    <p>아직 생성된 시리즈가 없습니다.</p>
                </div>
            ) : (
                <DndContext
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}>
                    <SortableContext
                        items={series.map(item => item.id)}
                        strategy={verticalListSortingStrategy}>
                        <div className="series-list">
                            {series.map(item => (
                                <SortableSeriesItem
                                    key={item.id}
                                    series={item}
                                    onEdit={handleOpenModal}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h3>{editingSeries ? '시리즈 수정' : '새 시리즈 생성'}</h3>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={handleCloseModal}>
                                <i className="fas fa-times" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit(onSubmit)}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label htmlFor="name" className="form-label">시리즈 이름</label>
                                    <input
                                        id="name"
                                        type="text"
                                        className="form-control"
                                        {...register('name')}
                                        placeholder="시리즈 이름"
                                    />
                                    {errors.name && <p className="text-danger">{errors.name.message}</p>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="url" className="form-label">URL</label>
                                    <input
                                        id="url"
                                        type="text"
                                        className="form-control"
                                        {...register('url')}
                                        placeholder="series-url"
                                    />
                                    <p className="form-help">영문, 숫자, 하이픈(-)만 사용할 수 있습니다.</p>
                                    {errors.url && <p className="text-danger">{errors.url.message}</p>}
                                </div>

                                <div className="form-group">
                                    <label htmlFor="description" className="form-label">설명</label>
                                    <textarea
                                        id="description"
                                        className="form-control"
                                        {...register('description')}
                                        rows={3}
                                        placeholder="시리즈에 대한 간단한 설명"
                                    />
                                    {errors.description && <p className="text-danger">{errors.description.message}</p>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">썸네일</label>
                                    <div className="thumbnail-container">
                                        {editingSeries?.thumbnail || thumbnail ? (
                                            <img
                                                src={editingSeries?.thumbnail || thumbnail}
                                                alt="썸네일 미리보기"
                                                className="thumbnail-preview"
                                            />
                                        ) : (
                                            <div className="thumbnail-placeholder">
                                                <i className="fas fa-image" />
                                            </div>
                                        )}
                                        <div className="thumbnail-upload">
                                            <label htmlFor="thumbnail-input" className="btn btn-secondary">
                                                <i className="fas fa-upload" /> 이미지 업로드
                                            </label>
                                            <input
                                                id="thumbnail-input"
                                                type="file"
                                                accept="image/*"
                                                onChange={handleThumbnailChange}
                                                className="thumbnail-input"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={handleCloseModal}>
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isLoading}>
                                    {isLoading ? '처리 중...' : (editingSeries ? '수정' : '생성')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
                .series-management {
                    position: relative;
                }

                .series-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }

                .series-title {
                    margin: 0;
                    font-size: 18px;
                }

                .empty-state {
                    padding: 40px 0;
                    text-align: center;
                    color: #6c757d;
                }

                .series-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .series-item {
                    display: flex;
                    gap: 16px;
                    padding: 16px;
                    background-color: #f8f9fa;
                    border-radius: 8px;
                }

                .series-drag-handle {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 24px;
                    cursor: grab;
                    color: #6c757d;
                }

                .series-drag-handle:active {
                    cursor: grabbing;
                }

                .series-thumbnail {
                    width: 80px;
                    height: 80px;
                    flex-shrink: 0;
                    border-radius: 4px;
                    overflow: hidden;
                }

                .series-thumbnail img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .thumbnail-placeholder {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background-color: #e9ecef;
                    color: #6c757d;
                    font-size: 24px;
                }

                .series-info {
                    flex: 1;
                }

                .series-name {
                    margin: 0 0 8px 0;
                    font-size: 18px;
                }

                .series-description {
                    margin: 0 0 8px 0;
                    font-size: 14px;
                    color: #6c757d;
                }

                .series-meta {
                    font-size: 14px;
                    color: #6c757d;
                }

                .series-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .btn-icon {
                    width: 36px;
                    height: 36px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 4px;
                    background-color: #fff;
                    border: 1px solid #ced4da;
                    color: #495057;
                    cursor: pointer;
                }

                .btn-icon.btn-danger {
                    color: #dc3545;
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal-container {
                    width: 90%;
                    max-width: 600px;
                    background-color: #fff;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .modal-header h3 {
                    margin: 0;
                    font-size: 18px;
                }

                .btn-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    color: #6c757d;
                }

                .modal-body {
                    padding: 16px;
                    max-height: 70vh;
                    overflow-y: auto;
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                    padding: 16px;
                    border-top: 1px solid #e0e0e0;
                }

                .form-help {
                    font-size: 12px;
                    color: #6c757d;
                    margin-top: 4px;
                }

                .thumbnail-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .thumbnail-preview {
                    max-width: 100%;
                    max-height: 200px;
                    border-radius: 44px;
                }

                .thumbnail-input {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default SeriesManagement;
