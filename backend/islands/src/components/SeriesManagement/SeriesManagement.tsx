import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface Series {
    id: number;
    name: string;
    url: string;
    description: string;
    thumbnail: string;
    postCount: number;
}

interface SeriesManagementProps {
    series: Series[];
}

const SeriesManagement: React.FC<SeriesManagementProps> = ({ series: initialSeries }) => {
    const [series, setSeries] = useState<Series[]>(initialSeries);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSeries, setEditingSeries] = useState<Series | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        url: '',
        description: '',
        thumbnail: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleOpenModal = (seriesItem: Series | null = null) => {
        if (seriesItem) {
            setEditingSeries(seriesItem);
            setFormData({
                name: seriesItem.name,
                url: seriesItem.url,
                description: seriesItem.description,
                thumbnail: seriesItem.thumbnail
            });
        } else {
            setEditingSeries(null);
            setFormData({
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
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
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
                setFormData(prev => ({
                    ...prev,
                    thumbnail: data.body.url
                }));
                notification('썸네일이 업로드되었습니다.', {
                    type: 'success'
                });
            } else {
                notification('썸네일 업로드에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('썸네일 업로드에 실패했습니다.', {
                type: 'error'
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { name, url, description, thumbnail } = formData;

            if (!name.trim()) {
                notification('시리즈 이름을 입력해주세요.', {
                    type: 'error'
                });
                setIsLoading(false);
                return;
            }

            if (!url.trim()) {
                notification('URL을 입력해주세요.', {
                    type: 'error'
                });
                setIsLoading(false);
                return;
            }

            if (editingSeries) {
                // Update existing series
                const { data } = await http(`v1/series/${editingSeries.id}`, {
                    method: 'PUT',
                    data: {
                        name,
                        url,
                        description,
                        thumbnail
                    }
                });

                if (data.status === 'DONE') {
                    setSeries(prev => prev.map(item =>
                        item.id === editingSeries.id
                            ? { ...item, name, url, description, thumbnail }
                            : item
                    ));
                    notification('시리즈가 업데이트 되었습니다.', {
                        type: 'success'
                    });
                    handleCloseModal();
                } else {
                    notification(data.message || '시리즈 업데이트에 실패했습니다.', {
                        type: 'error'
                    });
                }
            } else {
                // Create new series
                const { data } = await http('v1/series', {
                    method: 'POST',
                    data: {
                        name,
                        url,
                        description,
                        thumbnail
                    }
                });

                if (data.status === 'DONE') {
                    setSeries(prev => [...prev, data.body]);
                    notification('시리즈가 생성되었습니다.', {
                        type: 'success'
                    });
                    handleCloseModal();
                } else {
                    notification(data.message || '시리즈 생성에 실패했습니다.', {
                        type: 'error'
                    });
                }
            }
        } catch (error) {
            notification('요청 처리에 실패했습니다.', {
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('정말로 이 시리즈를 삭제하시겠습니까? 시리즈에 속한 포스트는 삭제되지 않습니다.')) {
            return;
        }

        try {
            const { data } = await http(`v1/series/${id}`, {
                method: 'DELETE'
            });

            if (data.status === 'DONE') {
                setSeries(prev => prev.filter(item => item.id !== id));
                notification('시리즈가 삭제되었습니다.', {
                    type: 'success'
                });
            } else {
                notification(data.message || '시리즈 삭제에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('시리즈 삭제에 실패했습니다.', {
                type: 'error'
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
                    onClick={() => handleOpenModal()}
                >
                    <i className="fas fa-plus"></i> 새 시리즈
                </button>
            </div>

            {series.length === 0 ? (
                <div className="empty-state">
                    <p>아직 생성된 시리즈가 없습니다.</p>
                </div>
            ) : (
                <div className="series-list">
                    {series.map(item => (
                        <div key={item.id} className="series-item">
                            <div className="series-thumbnail">
                                {item.thumbnail ? (
                                    <img src={item.thumbnail} alt={item.name} />
                                ) : (
                                    <div className="thumbnail-placeholder">
                                        <i className="fas fa-book"></i>
                                    </div>
                                )}
                            </div>
                            <div className="series-info">
                                <h4 className="series-name">{item.name}</h4>
                                <p className="series-description">{item.description || '설명 없음'}</p>
                                <div className="series-meta">
                                    <span className="series-count">
                                        <i className="fas fa-file-alt"></i> {item.postCount}개의 포스트
                                    </span>
                                </div>
                            </div>
                            <div className="series-actions">
                                <button
                                    type="button"
                                    className="btn btn-icon"
                                    onClick={() => handleOpenModal(item)}
                                >
                                    <i className="fas fa-edit"></i>
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-icon btn-danger"
                                    onClick={() => handleDelete(item.id)}
                                >
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-container">
                        <div className="modal-header">
                            <h3>{editingSeries ? '시리즈 수정' : '새 시리즈 생성'}</h3>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={handleCloseModal}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label htmlFor="name" className="form-label">시리즈 이름</label>
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        className="form-control"
                                        value={formData.name}
                                        onChange={handleChange}
                                        placeholder="시리즈 이름"
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="url" className="form-label">URL</label>
                                    <input
                                        id="url"
                                        name="url"
                                        type="text"
                                        className="form-control"
                                        value={formData.url}
                                        onChange={handleChange}
                                        placeholder="series-url"
                                    />
                                    <p className="form-help">영문, 숫자, 하이픈(-)만 사용할 수 있습니다.</p>
                                </div>

                                <div className="form-group">
                                    <label htmlFor="description" className="form-label">설명</label>
                                    <textarea
                                        id="description"
                                        name="description"
                                        className="form-control"
                                        value={formData.description}
                                        onChange={handleChange}
                                        rows={3}
                                        placeholder="시리즈에 대한 간단한 설명"
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">썸네일</label>
                                    <div className="thumbnail-container">
                                        {formData.thumbnail ? (
                                            <img
                                                src={formData.thumbnail}
                                                alt="썸네일 미리보기"
                                                className="thumbnail-preview"
                                            />
                                        ) : (
                                            <div className="thumbnail-placeholder">
                                                <i className="fas fa-image"></i>
                                            </div>
                                        )}
                                        <div className="thumbnail-upload">
                                            <label htmlFor="thumbnail-input" className="btn btn-secondary">
                                                <i className="fas fa-upload"></i> 이미지 업로드
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
                                    onClick={handleCloseModal}
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    disabled={isLoading}
                                >
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
                    border-radius: 4px;
                }

                .thumbnail-input {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default SeriesManagement;
