import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface IntegrationSettingsProps {
    settings: {
        googleAnalyticsId: string;
        disqusShortname: string;
        githubUsername: string;
        telegramToken: string;
        telegramChatId: string;
    };
}

const IntegrationSettings: React.FC<IntegrationSettingsProps> = ({ settings: initialSettings }) => {
    const [settings, setSettings] = useState({
        googleAnalyticsId: initialSettings.googleAnalyticsId || '',
        disqusShortname: initialSettings.disqusShortname || '',
        githubUsername: initialSettings.githubUsername || '',
        telegramToken: initialSettings.telegramToken || '',
        telegramChatId: initialSettings.telegramChatId || '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'analytics' | 'comments' | 'github' | 'telegram'>('analytics');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data } = await http('v1/setting/integration', {
                method: 'PUT',
                data: {
                    google_analytics_id: settings.googleAnalyticsId,
                    disqus_shortname: settings.disqusShortname,
                    github_username: settings.githubUsername,
                    telegram_token: settings.telegramToken,
                    telegram_chat_id: settings.telegramChatId,
                }
            });

            if (data.status === 'DONE') {
                notification('통합 설정이 업데이트 되었습니다.', {
                    type: 'success'
                });
            } else {
                notification('통합 설정 업데이트에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('통합 설정 업데이트에 실패했습니다.', {
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleTestTelegram = async () => {
        if (!settings.telegramToken || !settings.telegramChatId) {
            notification('Telegram 토큰과 채팅 ID를 모두 입력해주세요.', {
                type: 'error'
            });
            return;
        }

        setIsLoading(true);

        try {
            const { data } = await http('v1/setting/integration/telegram/test', {
                method: 'POST',
                data: {
                    token: settings.telegramToken,
                    chat_id: settings.telegramChatId
                }
            });

            if (data.status === 'DONE') {
                notification('Telegram 테스트 메시지가 성공적으로 전송되었습니다.', {
                    type: 'success'
                });
            } else {
                notification('Telegram 테스트 메시지 전송에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('Telegram 테스트 메시지 전송에 실패했습니다.', {
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="integration-settings">
            <div className="tabs">
                <button
                    className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('analytics')}
                >
                    Google Analytics
                </button>
                <button
                    className={`tab-button ${activeTab === 'comments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('comments')}
                >
                    Disqus
                </button>
                <button
                    className={`tab-button ${activeTab === 'github' ? 'active' : ''}`}
                    onClick={() => setActiveTab('github')}
                >
                    GitHub
                </button>
                <button
                    className={`tab-button ${activeTab === 'telegram' ? 'active' : ''}`}
                    onClick={() => setActiveTab('telegram')}
                >
                    Telegram
                </button>
            </div>

            <form onSubmit={handleSubmit}>
                <div className="tab-content">
                    {activeTab === 'analytics' && (
                        <div className="tab-pane">
                            <div className="integration-info">
                                <h3 className="integration-title">Google Analytics</h3>
                                <p className="integration-description">
                                    Google Analytics를 사용하여 블로그 방문자 통계를 추적할 수 있습니다.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="googleAnalyticsId" className="form-label">
                                    Google Analytics ID
                                </label>
                                <input
                                    id="googleAnalyticsId"
                                    name="googleAnalyticsId"
                                    type="text"
                                    className="form-control"
                                    value={settings.googleAnalyticsId}
                                    onChange={handleChange}
                                    placeholder="UA-XXXXXXXXX-X 또는 G-XXXXXXXXXX"
                                />
                                <p className="form-help">
                                    Google Analytics 추적 ID를 입력하세요. (예: UA-XXXXXXXXX-X 또는 G-XXXXXXXXXX)
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'comments' && (
                        <div className="tab-pane">
                            <div className="integration-info">
                                <h3 className="integration-title">Disqus</h3>
                                <p className="integration-description">
                                    Disqus를 사용하여 블로그 포스트에 댓글 기능을 추가할 수 있습니다.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="disqusShortname" className="form-label">
                                    Disqus Shortname
                                </label>
                                <input
                                    id="disqusShortname"
                                    name="disqusShortname"
                                    type="text"
                                    className="form-control"
                                    value={settings.disqusShortname}
                                    onChange={handleChange}
                                    placeholder="your-disqus-shortname"
                                />
                                <p className="form-help">
                                    Disqus 관리자 페이지에서 찾을 수 있는 shortname을 입력하세요.
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'github' && (
                        <div className="tab-pane">
                            <div className="integration-info">
                                <h3 className="integration-title">GitHub</h3>
                                <p className="integration-description">
                                    GitHub 사용자 이름을 연결하여 프로필에 GitHub 저장소를 표시할 수 있습니다.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="githubUsername" className="form-label">
                                    GitHub 사용자 이름
                                </label>
                                <input
                                    id="githubUsername"
                                    name="githubUsername"
                                    type="text"
                                    className="form-control"
                                    value={settings.githubUsername}
                                    onChange={handleChange}
                                    placeholder="github-username"
                                />
                                <p className="form-help">
                                    GitHub 사용자 이름을 입력하세요. (예: octocat)
                                </p>
                            </div>
                        </div>
                    )}

                    {activeTab === 'telegram' && (
                        <div className="tab-pane">
                            <div className="integration-info">
                                <h3 className="integration-title">Telegram</h3>
                                <p className="integration-description">
                                    Telegram을 통해 새 댓글이나 좋아요 알림을 받을 수 있습니다.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="telegramToken" className="form-label">
                                    Telegram Bot Token
                                </label>
                                <input
                                    id="telegramToken"
                                    name="telegramToken"
                                    type="text"
                                    className="form-control"
                                    value={settings.telegramToken}
                                    onChange={handleChange}
                                    placeholder="123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                                />
                                <p className="form-help">
                                    <a href="https://t.me/botfather" target="_blank" rel="noopener noreferrer">
                                        BotFather
                                    </a>를 통해 생성한 봇의 토큰을 입력하세요.
                                </p>
                            </div>

                            <div className="form-group">
                                <label htmlFor="telegramChatId" className="form-label">
                                    Telegram Chat ID
                                </label>
                                <input
                                    id="telegramChatId"
                                    name="telegramChatId"
                                    type="text"
                                    className="form-control"
                                    value={settings.telegramChatId}
                                    onChange={handleChange}
                                    placeholder="-123456789"
                                />
                                <p className="form-help">
                                    알림을 받을 채팅 ID를 입력하세요. 개인 채팅 또는 그룹 채팅 ID를 사용할 수 있습니다.
                                </p>
                            </div>

                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={handleTestTelegram}
                                disabled={isLoading || !settings.telegramToken || !settings.telegramChatId}
                            >
                                {isLoading ? '테스트 중...' : '테스트 메시지 보내기'}
                            </button>
                        </div>
                    )}
                </div>

                <div className="form-actions">
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isLoading}
                    >
                        {isLoading ? '저장 중...' : '저장'}
                    </button>
                </div>
            </form>

            <style jsx>{`
        .integration-settings {
          margin-top: 8px;
        }

        .tabs {
          display: flex;
          overflow-x: auto;
          border-bottom: 1px solid #dee2e6;
          margin-bottom: 20px;
        }

        .tab-button {
          padding: 10px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          font-size: 14px;
          white-space: nowrap;
          color: #6c757d;
        }

        .tab-button.active {
          border-bottom-color: #4568dc;
          color: #4568dc;
          font-weight: 600;
        }

        .tab-content {
          margin-bottom: 24px;
        }

        .tab-pane {
          animation: fadeIn 0.3s;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .integration-info {
          margin-bottom: 20px;
        }

        .integration-title {
          font-size: 18px;
          margin: 0 0 8px 0;
        }

        .integration-description {
          color: #6c757d;
          margin: 0;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
        }

        .form-control {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 16px;
        }

        .form-help {
          margin-top: 4px;
          font-size: 12px;
          color: #6c757d;
        }

        .form-actions {
          margin-top: 24px;
        }
      `}</style>
        </div>
    );
};

export default IntegrationSettings;
