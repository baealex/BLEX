import { useState, useEffect } from 'react';
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader } from '../../components';
import { Button, Card } from '~/components/shared';
import { useConfirm } from '~/hooks/useConfirm';
import { getTelegramStatus, generateTelegramToken, disconnectTelegram as disconnectTelegramAPI } from '~/lib/api/telegram';

const IntegrationSettings = () => {
    const [telegramToken, setTelegramToken] = useState('');
    const [isGeneratingToken, setIsGeneratingToken] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);
    const { confirm } = useConfirm();

    const { data: telegramData, refetch } = useSuspenseQuery({
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
        if (isConnected) {
            // 연동된 상태면 토큰 초기화
            setTelegramToken('');
        }
    }, [isConnected]);

    // 연결 상태 폴링 (연결되지 않은 경우에만)
    useEffect(() => {
        if (!isConnected) {
            const interval = setInterval(() => {
                refetch();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [isConnected, refetch]);

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="텔레그램 연동"
                description="텔레그램 봇과 연동하여 실시간 알림을 받아보세요."
            />

            {isConnected ? (
                <Card
                    title="연동 상태"
                    subtitle="현재 텔레그램 연동 상태입니다."
                    icon={<i className="fas fa-plug" />}>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="flex items-center justify-center w-12 h-12 bg-action rounded-xl flex-shrink-0">
                                <i className="fas fa-check text-content-inverted text-base" />
                            </div>
                            <div>
                                <h4 className="text-base font-semibold text-content">연동 완료</h4>
                                <p className="text-sm text-content-secondary mt-1">텔레그램으로 실시간 알림을 받을 수 있습니다.</p>
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
                </Card>
            ) : (
                <Card
                    title="연동 방법"
                    subtitle="아래 순서대로 진행하면 텔레그램 연동을 완료할 수 있습니다."
                    icon={<i className="fas fa-link" />}>
                    <div className="space-y-6">
                        <div className="flex items-start gap-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface-subtle text-content text-sm font-semibold flex-shrink-0">
                                1
                            </span>
                            <p className="text-sm text-content leading-relaxed">
                                텔레그램 앱에서{' '}
                                <a
                                    href="https://t.me/blex_bot"
                                    className="inline-flex items-center text-content hover:text-content font-medium underline decoration-1 underline-offset-2"
                                    target="_blank"
                                    rel="noopener noreferrer">
                                    @blex_bot
                                    <i className="fas fa-external-link-alt ml-1 text-xs" />
                                </a>
                                을 찾아 대화를 시작하세요.
                            </p>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-surface-subtle text-content text-sm font-semibold flex-shrink-0">
                                2
                            </span>
                            <div className="flex-1 space-y-3">
                                <p className="text-sm text-content">봇에게 아래 인증 코드를 전송하세요.</p>
                                {telegramToken ? (
                                    <div className="rounded-xl border border-line bg-surface-subtle p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                            <code className="font-mono text-sm sm:text-base font-semibold tracking-wide text-content break-all flex-1">
                                                {telegramToken}
                                            </code>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => navigator.clipboard?.writeText(telegramToken)}>
                                                복사
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-xl border border-dashed border-line bg-surface-subtle p-4">
                                        <Button
                                            variant="primary"
                                            size="md"
                                            isLoading={isGeneratingToken}
                                            onClick={refreshToken}>
                                            {isGeneratingToken ? '생성 중...' : '인증 코드 생성'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {telegramToken && (
                            <div className="rounded-xl border border-line bg-surface-subtle p-4 text-sm text-content leading-relaxed">
                                이 코드는 일회용이며 연동 완료 또는 24시간 후 자동으로 만료됩니다. 연동 후 상태를 새로고침하세요.
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default IntegrationSettings;
