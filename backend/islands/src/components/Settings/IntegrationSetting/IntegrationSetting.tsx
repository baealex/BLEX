import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';

interface TelegramStatusData {
    isConnected: boolean;
}

const IntegrationSettings: React.FC = () => {
    const [telegramToken, setTelegramToken] = useState('');
    const [isGeneratingToken, setIsGeneratingToken] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const { data: telegramData, isLoading, refetch } = useFetch({
        queryKey: ['telegram-integration'],
        queryFn: async () => {
            const { data } = await http<Response<TelegramStatusData>>('v1/setting/integration-telegram', { method: 'GET' });
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('텔레그램 연동 정보를 불러오는데 실패했습니다.');
        }
    });

    const isConnected = telegramData?.isConnected === true;

    const refreshToken = async () => {
        if (isGeneratingToken) return;

        setIsGeneratingToken(true);
        try {
            const { data } = await http('v1/telegram/makeToken', { method: 'POST' });
            if (data.status === 'DONE' && data.body.token) {
                setTelegramToken(data.body.token);
            } else {
                notification('토큰 생성에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('토큰 생성 중 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsGeneratingToken(false);
        }
    };

    const disconnectTelegram = async () => {
        if (!confirm('정말 텔레그램 연동을 해제할까요?')) {
            return;
        }

        setIsDisconnecting(true);
        try {
            const { data } = await http('v1/telegram/unsync', { method: 'POST' });
            if (data.status === 'DONE') {
                notification('텔레그램 연동이 해제되었습니다.', { type: 'success' });
                setTelegramToken('');
                refetch();
            } else if (data.errorCode === 'ALREADY_DISCONNECTED') {
                notification('이미 연동이 해제된 상태입니다.', { type: 'info' });
                refetch();
            } else {
                notification(data.errorMessage || '연동 해제에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        } finally {
            setIsDisconnecting(false);
        }
    };

    // 연동 상태에 따른 토큰 관리
    useEffect(() => {
        if (!isLoading) {
            if (isConnected) {
                // 연동된 상태면 토큰 초기화
                setTelegramToken('');
            }
        }
    }, [isLoading, isConnected]);

    // 연결 상태 폴링 (연결되지 않은 경우에만)
    useEffect(() => {
        if (!isConnected) {
            const interval = setInterval(() => {
                refetch();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [isConnected, refetch]);

    if (isLoading) {
        return (
            <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
                <div className="animate-pulse">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                        <div className="h-6 bg-gray-200 rounded w-64 mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                        <div className="h-20 bg-gray-200 rounded" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 bg-white shadow-sm rounded-lg">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-blue-900 mb-2">텔레그램 연동</h2>
                <p className="text-blue-700 mb-4">텔레그램 봇과 연동하여 실시간 알림을 받아보세요.</p>

                <div className="space-y-2">
                    <div className="flex items-center text-sm text-blue-700">
                        <i className="fas fa-check-circle mr-2 text-blue-600" />
                        실시간으로 댓글, 좋아요 등의 알림을 전달받습니다
                    </div>
                    <div className="flex items-center text-sm text-blue-700">
                        <i className="fas fa-check-circle mr-2 text-blue-600" />
                        로그인 시 2차 인증을 사용할 수 있습니다
                    </div>
                </div>
            </div>

            {/* Connection Status */}
            {isConnected ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full flex-shrink-0">
                                <i className="fas fa-check text-green-600 text-xl" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-green-900">연동 완료!</h3>
                                <p className="text-sm text-green-700 mt-1">
                                    텔레그램으로 실시간 알림을 받을 수 있습니다.
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                            onClick={disconnectTelegram}
                            disabled={isDisconnecting}>
                            {isDisconnecting ? (
                                <>
                                    <i className="fas fa-spinner fa-spin mr-2" />
                                    해제 중...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-unlink mr-2" />
                                    연동 해제
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4 sm:space-y-6">
                    {/* Connection Guide */}
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-6">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <i className="fas fa-link mr-2 text-gray-500" />
                            연동 방법
                        </h3>

                        <div className="space-y-4 sm:space-y-6">
                            {/* Step 1 */}
                            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                <div className="flex items-center sm:items-start gap-3">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 text-sm font-bold rounded-full flex-shrink-0">
                                        1
                                    </span>
                                    <div className="flex-1">
                                        <p className="text-gray-700 leading-relaxed">
                                            텔레그램 앱에서{' '}
                                            <a
                                                href="https://t.me/blex_bot"
                                                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium underline decoration-1 underline-offset-2"
                                                target="_blank"
                                                rel="noopener noreferrer">
                                                @blex_bot
                                                <i className="fas fa-external-link-alt ml-1 text-xs" />
                                            </a>
                                            을 찾아 대화를 시작하세요.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                <div className="flex items-start gap-3">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 text-blue-800 text-sm font-bold rounded-full flex-shrink-0">
                                        2
                                    </span>
                                    <div className="flex-1 space-y-3">
                                        <p className="text-gray-700 leading-relaxed">
                                            봇에게 아래 인증 코드를 전송하세요:
                                        </p>

                                        {telegramToken ? (
                                            <div className="bg-gray-900 text-white p-3 sm:p-4 rounded-lg">
                                                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                    <code className="font-mono text-base sm:text-lg font-bold tracking-wider flex-1 break-all">
                                                        {telegramToken}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded text-gray-900 bg-white hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-white transition-colors flex-shrink-0"
                                                        onClick={() => navigator.clipboard?.writeText(telegramToken)}
                                                        title="클립보드에 복사">
                                                        <i className="fas fa-copy mr-1" />
                                                        복사
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                                <button
                                                    type="button"
                                                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    onClick={refreshToken}
                                                    disabled={isGeneratingToken}>
                                                    {isGeneratingToken ? (
                                                        <>
                                                            <i className="fas fa-spinner fa-spin mr-2" />
                                                            생성 중...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fas fa-key mr-2" />
                                                            인증 코드 생성
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {telegramToken && (
                            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <i className="fas fa-info-circle text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-amber-800 leading-relaxed">
                                        <p className="font-medium mb-1">인증 코드 안내</p>
                                        <p>이 코드는 일회용이며 연동 완료 또는 24시간 후 자동으로 만료됩니다. 연동 후 새로고침 해주세요.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrationSettings;
