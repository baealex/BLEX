import { useState } from 'react';
import { Button } from '~/components/shared';
import type { BannerData } from '~/lib/api/settings';

interface BannerListProps {
    banners: BannerData[];
    onEdit: (banner: BannerData) => void;
    onDelete: (id: number) => void;
    onToggleActive: (banner: BannerData) => void;
    onReorder: (banners: BannerData[]) => void;
}

export const BannerList = ({ banners, onEdit, onDelete, onToggleActive, onReorder }: BannerListProps) => {
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const handleDragStart = (index: number) => {
        setDraggedIndex(index);
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newBanners = [...banners];
        const draggedBanner = newBanners[draggedIndex];
        newBanners.splice(draggedIndex, 1);
        newBanners.splice(index, 0, draggedBanner);

        onReorder(newBanners);
        setDraggedIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedIndex(null);
    };

    const getBannerTypeLabel = (type: string) => {
        return type === 'horizontal' ? '줄배너' : '사이드배너';
    };

    const getPositionLabel = (position: string) => {
        const labels: Record<string, string> = {
            top: '상단',
            bottom: '하단',
            left: '좌측',
            right: '우측'
        };
        return labels[position] || position;
    };

    const getPositionBadgeColor = (position: string) => {
        const colors: Record<string, string> = {
            top: 'bg-blue-100 text-blue-800',
            bottom: 'bg-green-100 text-green-800',
            left: 'bg-purple-100 text-purple-800',
            right: 'bg-pink-100 text-pink-800'
        };
        return colors[position] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="space-y-3">
            {banners.map((banner, index) => (
                <div
                    key={banner.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-move ${
                        draggedIndex === index ? 'opacity-50' : ''
                    }`}>
                    <div className="flex items-start justify-between">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="flex items-center text-gray-400">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm0 2h6v12H7V4zm1 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">{banner.title}</h3>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getPositionBadgeColor(banner.position)}`}>
                                    {getPositionLabel(banner.position)}
                                </span>
                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                                    {getBannerTypeLabel(banner.banner_type)}
                                </span>
                                {banner.is_active ? (
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                                        활성화
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-500">
                                        비활성화
                                    </span>
                                )}
                            </div>
                            <div className="bg-gray-50 rounded p-3 mt-2 overflow-x-auto">
                                <code className="text-xs text-gray-600">
                                    {banner.content_html.substring(0, 200)}
                                    {banner.content_html.length > 200 && '...'}
                                </code>
                            </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                            <Button
                                onClick={() => onToggleActive(banner)}
                                variant="secondary"
                                size="sm"
                                title={banner.is_active ? '비활성화' : '활성화'}>
                                {banner.is_active ? (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" fillRule="evenodd" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                    </svg>
                                )}
                            </Button>
                            <Button
                                onClick={() => onEdit(banner)}
                                variant="secondary"
                                size="sm"
                                title="수정"
                                leftIcon={
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                }>
                                수정
                            </Button>
                            <Button
                                onClick={() => onDelete(banner.id)}
                                variant="secondary"
                                size="sm"
                                title="삭제"
                                leftIcon={
                                    <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                }>
                                삭제
                            </Button>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
