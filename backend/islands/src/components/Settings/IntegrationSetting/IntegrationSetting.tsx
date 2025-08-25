import React, { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface TelegramConnection {
    isConnected: boolean;
    telegramId?: string;
}

const IntegrationSettings: React.FC = () => {
    const [telegramConnection, setTelegramConnection] = useState<TelegramConnection>({ isConnected: false });
    const [telegramToken, setTelegramToken] = useState('');

    const fetchTelegramStatus = async () => {
        try {
            const { data } = await http('v1/setting/integration-telegram', { method: 'GET' });
            if (data.status === 'DONE') {
                setTelegramConnection({
                    isConnected: data.body.isConnected,
                    telegramId: data.body.telegramId
                });
                if (!data.body.isConnected) {
                    refreshToken();
                }
            }
        } catch {
            notification('텔레그램 연동 정보를 불러오는데 실패했습니다.', { type: 'error' });
        }
    };

    useEffect(() => {
        fetchTelegramStatus();

        const interval = setInterval(() => {
            if (!telegramConnection.isConnected) {
                fetchTelegramStatus();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [telegramConnection.isConnected]);

    const refreshToken = async () => {
        try {
            const { data } = await http('v1/telegram/makeToken', { method: 'POST' });
            if (data.status === 'DONE' && data.body.token) {
                setTelegramToken(data.body.token);
            }
        } catch {
            notification('토큰 생성에 실패했습니다.', { type: 'error' });
        }
    };

    const disconnectTelegram = async () => {
        if (!confirm('정말 연동을 해제할까요?')) {
            return;
        }

        try {
            const { data } = await http('v1/telegram/unsync', { method: 'POST' });
            if (data.status === 'DONE') {
                notification('연동이 해제되었습니다.', { type: 'success' });
                setTelegramConnection({ isConnected: false });
                refreshToken();
            } else {
                notification(data.errorMessage || '연동 해제에 실패했습니다.', { type: 'error' });
            }
        } catch {
            notification('네트워크 오류가 발생했습니다.', { type: 'error' });
        }
    };

    return (
        <div className="p-6 bg-white shadow-md rounded-lg">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-4">
                    텔레그램과 연동하면 어떤 효과가 있나요?
                </h3>
                <ul className="text-blue-800 space-y-2 mb-4">
                    <li className="flex items-start">
                        <svg className="w-5 h-5 mt-0.5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        실시간으로 회원님의 알림을 전달해 드립니다.
                    </li>
                    <li className="flex items-start">
                        <svg className="w-5 h-5 mt-0.5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        로그인시 2차 인증을 사용할 수 있습니다.
                    </li>
                </ul>
            </div>

            {!telegramConnection.isConnected && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                    <h4 className="text-md font-semibold text-gray-900 mb-4">어떻게 연동하나요?</h4>
                    <div className="space-y-3 mb-4">
                        <div className="flex items-start">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full mr-3 mt-0.5">1</span>
                            <span className="text-gray-700">
                                텔레그램을 실행하고{' '}
                                <a
                                    href="http://t.me/blex_bot"
                                    className="text-blue-600 hover:text-blue-800 font-medium"
                                    target="_blank"
                                    rel="noopener noreferrer">
                                    @blex_bot
                                </a>
                                을 추가해주세요!
                            </span>
                        </div>
                        <div className="flex items-start">
                            <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full mr-3 mt-0.5">2</span>
                            <div className="text-gray-700">
                                봇에게 다음 코드를 전송해주세요:
                                <div className="mt-2 p-3 bg-gray-900 text-white font-mono text-sm rounded-lg">
                                    {telegramToken}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="text-sm text-gray-500 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        해당 토큰은 회원님을 위해 생성된 일회성 토큰이며 연동을 완료되거나 오늘이 지나면 파기됩니다.
                    </div>
                </div>
            )}

            {telegramConnection.isConnected && (
                <div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <div className="flex items-center">
                            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-full mr-4">
                                <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                                </svg>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-semibold text-green-900">텔레그램이 연동되어 있습니다!</h4>
                                <p className="text-sm text-green-600">텔레그램으로 알림을 받을 수 있습니다.</p>
                            </div>
                            <button className="bg-red-50 border border-solid border-red-200 rounded-lg p-2 px-4 text-sm font-medium text-red-600" onClick={disconnectTelegram}>연동 해제</button>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default IntegrationSettings;
