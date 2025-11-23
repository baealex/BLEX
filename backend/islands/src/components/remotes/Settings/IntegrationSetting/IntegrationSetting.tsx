import { useState, useEffect } from 'react';
import { toast } from '~/utils/toast';
import { useQuery } from '@tanstack/react-query';
import { Button } from '~/components/shared';
import { useConfirm } from '~/contexts/ConfirmContext';
import { getTelegramStatus, generateTelegramToken, disconnectTelegram as disconnectTelegramAPI } from '~/lib/api/telegram';

const IntegrationSettings = () => {
    const [telegramToken, setTelegramToken] = useState('');
    const [isGeneratingToken, setIsGeneratingToken] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const { confirm } = useConfirm();

    const { data: telegramData, isLoading, refetch } = useQuery({
        queryKey: ['telegram-integration'],
        queryFn: async () => {
            const { data } = await getTelegramStatus();
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
            const { data } = await generateTelegramToken();
            if (data.status === 'DONE' && data.body.token) {
                setTelegramToken(data.body.token);
            } else {
                toast.error('토큰 생성에 실패했습니다.');
            }
        } catch {
            toast.error('토큰 생성 중 오류가 발생했습니다.');
        } finally {
            setIsGeneratingToken(false);
        }
    };

    const disconnectTelegram = async () => {
        const confirmed = await confirm({
            title: '텔레그램 연동 해제',
            message: '정말 텔레그램 연동을 해제할까요?',
            confirmText: '연동 해제',
            variant: 'danger'
        });

        if (!confirmed) return;

        setIsDisconnecting(true);
        try {
            const { data } = await disconnectTelegramAPI();
            if (data.status === 'DONE') {
                toast.success('텔레그램 연동이 해제되었습니다.');
                setTelegramToken('');
                refetch();
            } else if (data.errorCode === 'ALREADY_DISCONNECTED') {
                toast.info('이미 연동이 해제된 상태입니다.');
                refetch();
            } else {
                toast.error(data.errorMessage || '연동 해제에 실패했습니다.');
            }
        } catch {
            toast.error('네트워크 오류가 발생했습니다.');
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
        return null;
    }

    return (
        <div className="p-6 bg-white shadow-sm rounded-2xl border border-gray-200">
            {/* Header Section */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">텔레그램 연동</h2>
                <p className="text-gray-600 mb-6">텔레그램 봇과 연동하여 실시간 알림을 받아보세요.</p>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center text-sm text-gray-700">
                        <div className="w-6 h-6 bg-black rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <i className="fas fa-check text-white text-xs" />
                        </div>
                        실시간으로 댓글, 좋아요 등의 알림을 전달받습니다
                    </div>
                </div>
            </div>

            {/* Connection Status */}
            {isConnected ? (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex items-center justify-center w-14 h-14 bg-black rounded-2xl flex-shrink-0 shadow-md">
                                <i className="fas fa-check text-white text-xl" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-gray-900">연동 완료!</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    텔레그램으로 실시간 알림을 받을 수 있습니다.
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="danger"
                            size="md"
                            isLoading={isDisconnecting}
                            leftIcon={!isDisconnecting ? <i className="fas fa-unlink" /> : undefined}
                            onClick={disconnectTelegram}
                            className="flex-shrink-0">
                            {isDisconnecting ? '해제 중...' : '연동 해제'}
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Connection Guide */}
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <i className="fas fa-link mr-2 text-gray-500" />
                            연동 방법
                        </h3>

                        <div className="space-y-4 sm:space-y-6">
                            {/* Step 1 */}
                            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                                <div className="flex items-center sm:items-start gap-3">
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-800 text-sm font-bold rounded-full flex-shrink-0">
                                        1
                                    </span>
                                    <div className="flex-1">
                                        <p className="text-gray-700 leading-relaxed">
                                            텔레그램 앱에서{' '}
                                            <a
                                                href="https://t.me/blex_bot"
                                                className="inline-flex items-center text-gray-600 hover:text-gray-800 font-medium underline decoration-1 underline-offset-2"
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
                                    <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-800 text-sm font-bold rounded-full flex-shrink-0">
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
                                            <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
                                                <Button
                                                    variant="primary"
                                                    size="md"
                                                    isLoading={isGeneratingToken}
                                                    leftIcon={!isGeneratingToken ? <i className="fas fa-key" /> : undefined}
                                                    onClick={refreshToken}>
                                                    {isGeneratingToken ? '생성 중...' : '인증 코드 생성'}
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {telegramToken && (
                            <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <i className="fas fa-info-circle text-gray-600 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-gray-800 leading-relaxed">
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
