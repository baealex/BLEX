import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface TelegramConnection {
    is_connected: boolean;
    telegram_id?: string;
}

interface IntegrationSettingsProps {
    telegramConnection: TelegramConnection;
    telegramToken?: string;
}

const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({
    telegramConnection: initialConnection,
    telegramToken: initialToken
}) => {
    const [telegramConnection, setTelegramConnection] = useState(initialConnection);
    const [telegramToken, setTelegramToken] = useState(initialToken || '');

    useEffect(() => {
        if (!telegramConnection.is_connected) {
            // Check connection status periodically
            const interval = setInterval(() => {
                checkConnectionStatus();
            }, 5000);

            return () => clearInterval(interval);
        }
    }, [telegramConnection.is_connected]);

    const checkConnectionStatus = async () => {
        try {
            const { data } = await http.get('/v1/telegram/status');
            if (data.status === 'DONE' && data.body.isConnected) {
                setTelegramConnection({ 
                    is_connected: true, 
                    telegram_id: data.body.telegramId 
                });
            }
        } catch (error) {
            console.error('Error checking connection status:', error);
        }
    };

    const refreshToken = async () => {
        try {
            const { data } = await http.post('/v1/telegram/makeToken');
            if (data.status === 'DONE' && data.body.token) {
                setTelegramToken(data.body.token);
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
        }
    };

    const disconnectTelegram = async () => {
        if (!confirm('정말 연동을 해제할까요?')) {
            return;
        }

        try {
            const { data } = await http.post('/v1/telegram/unsync');
            if (data.status === 'DONE') {
                notification('연동이 해제되었습니다.', { type: 'success' });
                setTelegramConnection({ is_connected: false });
                // Refresh token for next connection
                refreshToken();
            } else {
                notification(data.errorMessage || '연동 해제에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    return (
        <div className="integration-settings">
            <div className="card setting-card">
                <div className="card-body">
                    <div style={{ lineHeight: '1.75' }}>
                        <div className="mb-3">
                            <strong>텔레그램과 연동하면 어떤 효과가 있나요?</strong>
                        </div>
                        <ul className="mb-3">
                            <li>실시간으로 회원님의 알림을 전달해 드립니다.</li>
                            <li>로그인시 2차 인증을 사용할 수 있습니다.</li>
                        </ul>
                        
                        {!telegramConnection.is_connected && (
                            <>
                                <div className="my-3">
                                    <strong>어떻게 연동하나요?</strong>
                                    <ul>
                                        <li>
                                            텔레그램을 실행하고{' '}
                                            <a 
                                                href="http://t.me/blex_bot" 
                                                className="text-decoration-none"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                @blex_bot
                                            </a>
                                            을 추가해주세요!
                                        </li>
                                        <li>
                                            봇에게{' '}
                                            <code className="bg-primary text-white px-2 py-1 rounded">
                                                {telegramToken}
                                            </code>
                                            을 전송해주세요!
                                        </li>
                                    </ul>
                                </div>
                                <div className="text-muted">
                                    해당 토큰은 회원님을 위해 생성된 일회성 토큰이며 연동을 완료되거나 오늘이 지나면 파기됩니다.
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {telegramConnection.is_connected && (
                <div className="card setting-card mt-3">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center flex-wrap">
                            <div>
                                <div className="d-flex align-items-center mb-2">
                                    <i className="fab fa-telegram-plane text-primary fs-4 me-2"></i>
                                    <span className="fw-bold">연동된 아이디</span>
                                </div>
                                <div className="fs-5">{telegramConnection.telegram_id}</div>
                            </div>
                        </div>
                        <button 
                            type="button" 
                            className="btn btn-outline-danger w-100 mt-3"
                            onClick={disconnectTelegram}
                        >
                            연동 해제
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IntegrationSettings;