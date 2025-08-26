import { useState, useEffect } from 'react';
import { http, type Response } from '~/modules/http.module';
import { notification } from '@baejino/ui';
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
    SortableContext,
    verticalListSortingStrategy,
    arrayMove,
    sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import { useFetch } from '~/hooks/use-fetch';

interface Series {
    id: number;
    url: string;
    title: string;
    totalPosts: number;
}

interface SortableSeriesItemProps {
    series: Series;
    username: string;
}

const SortableSeriesItem = ({ series, username }: SortableSeriesItemProps) => {
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

    const handleEdit = () => {
        window.location.href = `/@${username}/series/${series.url}/edit`;
    };

    const handleView = () => {
        window.location.href = `/@${username}/series/${series.url}`;
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-4">
            {/* 데스크탑 레이아웃 */}
            <div className="hidden sm:flex items-center gap-4 p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-200/60 transition-all duration-200 group">
                <div
                    className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 w-8 h-8 flex items-center justify-center transition-colors group-hover:text-indigo-500 hover:bg-slate-100 rounded-lg"
                    style={{ touchAction: 'none' }}
                    {...attributes}
                    {...listeners}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M3 5h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2zm0 4h14a1 1 0 010 2H3a1 1 0 010-2z" />
                    </svg>
                </div>

                <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg shadow-sm group-hover:from-indigo-50 group-hover:to-indigo-100 transition-all duration-200">
                    <svg className="w-6 h-6 text-slate-600 group-hover:text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                </div>

                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-1 group-hover:text-indigo-900 transition-colors">{series.title}</h3>
                    <div className="text-sm text-slate-500 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                        </svg>
                        {series.totalPosts}개의 포스트
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={handleView}
                        className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        보기
                    </button>
                    <button
                        onClick={handleEdit}
                        className="inline-flex items-center px-3 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        수정
                    </button>
                </div>
            </div>

            {/* 모바일 레이아웃 */}
            <div className="sm:hidden bg-white border border-slate-200/60 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                {/* 상단 헤더 */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200/60">
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
                            <svg className="w-4 h-4 text-slate-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="text-sm font-medium text-slate-700">시리즈</span>
                    </div>
                </div>

                {/* 컨텐츠 영역 */}
                <div className="p-4 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">{series.title}</h3>
                        <div className="text-sm text-slate-500 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                            {series.totalPosts}개의 포스트
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            onClick={handleView}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            보기
                        </button>
                        <button
                            onClick={handleEdit}
                            className="flex-1 inline-flex items-center justify-center px-3 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            수정
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SeriesSetting = () => {
    const [series, setSeries] = useState<Series[]>([]);
    const [username, setUsername] = useState<string>('');

    const { data: seriesData, isLoading, isError } = useFetch({
        queryKey: ['series-setting'],
        queryFn: async () => {
            const { data } = await http<Response<{ username: string; series: Series[] }>>('v1/setting/series', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('시리즈 목록을 불러오는데 실패했습니다.');
        }
    });

    useEffect(() => {
        if (seriesData) {
            setSeries(seriesData.series);
            setUsername(seriesData.username);
        }
    }, [seriesData]);

    useEffect(() => {
        if (isError) {
            notification('시리즈 목록을 불러오는데 실패했습니다.', { type: 'error' });
        }
    }, [isError]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = series.findIndex((item) => item.id === active.id);
            const newIndex = series.findIndex((item) => item.id === over.id);

            const newSeries = arrayMove(series, oldIndex, newIndex);
            setSeries(newSeries);

            try {
                // Use the series order API endpoint
                // This API expects JSON data with 'order' field containing array of [id, order] pairs
                const orderData = newSeries.map((item, idx) => [item.id, idx]);

                const { data } = await http('v1/series/order', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    data: JSON.stringify({ order: orderData })
                });

                if (data.status !== 'DONE') {
                    throw new Error('Order update failed');
                }

                notification('시리즈 순서가 변경되었습니다.', { type: 'success' });
            } catch {
                // Revert on error
                setSeries(series);
                notification('시리즈 순서 변경에 실패했습니다.', { type: 'error' });
            }
        }
    };

    const handleCreateSeries = () => {
        window.location.href = `/@${username}/series/create`;
    };

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 bg-white shadow-md rounded-lg">
                <div className="animate-pulse">
                    <div className="flex justify-between items-center mb-4 sm:mb-6">
                        <div className="h-6 bg-gray-200 rounded w-32" />
                        <div className="h-10 w-28 bg-gray-200 rounded-md" />
                    </div>
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                                <div className="w-5 h-5 bg-gray-200 rounded" />
                                <div className="flex-1">
                                    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-8 w-16 bg-gray-200 rounded" />
                                    <div className="h-8 w-16 bg-gray-200 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm border border-slate-200/60 rounded-xl">
            {/* 헤더 섹션 */}
            <div className="mb-6">
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200/60 rounded-xl p-4 sm:p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg sm:text-xl font-bold text-indigo-900 mb-2 flex items-center">
                                <svg className="w-5 h-5 mr-3 text-indigo-700" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                                </svg>
                                내 시리즈 ({series.length})
                            </h2>
                            <p className="text-indigo-700 text-sm">시리즈 순서를 드래그하여 조정하거나 새로운 시리즈를 만들어보세요.</p>
                        </div>
                        <button
                            onClick={handleCreateSeries}
                            className="hidden sm:inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            새 시리즈 만들기
                        </button>
                    </div>
                    <div className="sm:hidden mt-4">
                        <button
                            onClick={handleCreateSeries}
                            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            새 시리즈 만들기
                        </button>
                    </div>
                </div>
            </div>

            <div className="mb-6">
                {series.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 mx-auto bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <svg className="w-8 h-8 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-slate-900 mb-2">시리즈가 없습니다</h3>
                        <p className="text-slate-500 mb-4">첫 번째 시리즈를 만들어보세요!</p>
                        <button
                            onClick={handleCreateSeries}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors duration-200 shadow-sm hover:shadow-md">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            첫 시리즈 만들기
                        </button>
                    </div>
            ) : (
                <DndContext
                    sensors={sensors}
                    modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}>
                    <SortableContext
                        items={series.map(item => item.id)}
                        strategy={verticalListSortingStrategy}>
                        <div>
                            {series.map((item) => (
                                <SortableSeriesItem
                                    key={item.id}
                                    series={item}
                                    username={username}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
                )}
            </div>
        </div>
    );
};

export default SeriesSetting;
