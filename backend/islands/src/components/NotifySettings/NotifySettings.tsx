import React, { useState } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';

interface NotifySettingsProps {
    settings: {
        comment: boolean;
        commentReply: boolean;
        like: boolean;
        follow: boolean;
        message: boolean;
    };
}

const NotifySettings: React.FC<NotifySettingsProps> = ({ settings: initialSettings }) => {
    const [settings, setSettings] = useState({
        comment: initialSettings.comment,
        commentReply: initialSettings.commentReply,
        like: initialSettings.like,
        follow: initialSettings.follow,
        message: initialSettings.message
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: checked
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data } = await http('v1/setting/notify', {
                method: 'PUT',
                data: {
                    comment: settings.comment,
                    comment_reply: settings.commentReply,
                    like: settings.like,
                    follow: settings.follow,
                    message: settings.message
                }
            });

            if (data.status === 'DONE') {
                notification('알림 설정이 업데이트 되었습니다.', {
                    type: 'success'
                });
            } else {
                notification('알림 설정 업데이트에 실패했습니다.', {
                    type: 'error'
                });
            }
        } catch (error) {
            notification('알림 설정 업데이트에 실패했습니다.', {
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="notify-settings">
            <form onSubmit={handleSubmit}>
                <div className="settings-list">
                    <div className="setting-item">
                        <div className="setting-info">
                            <h3 className="setting-title">댓글 알림</h3>
                            <p className="setting-description">내 포스트에 댓글이 달릴 때 알림을 받습니다.</p>
                        </div>
                        <div className="setting-control">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    name="comment"
                                    checked={settings.comment}
                                    onChange={handleChange}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3 className="setting-title">댓글 답글 알림</h3>
                            <p className="setting-description">내 댓글에 답글이 달릴 때 알림을 받습니다.</p>
                        </div>
                        <div className="setting-control">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    name="commentReply"
                                    checked={settings.commentReply}
                                    onChange={handleChange}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3 className="setting-title">좋아요 알림</h3>
                            <p className="setting-description">내 포스트나 댓글에 좋아요가 달릴 때 알림을 받습니다.</p>
                        </div>
                        <div className="setting-control">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    name="like"
                                    checked={settings.like}
                                    onChange={handleChange}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3 className="setting-title">팔로우 알림</h3>
                            <p className="setting-description">새로운 팔로워가 생길 때 알림을 받습니다.</p>
                        </div>
                        <div className="setting-control">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    name="follow"
                                    checked={settings.follow}
                                    onChange={handleChange}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>

                    <div className="setting-item">
                        <div className="setting-info">
                            <h3 className="setting-title">메시지 알림</h3>
                            <p className="setting-description">새로운 메시지가 도착했을 때 알림을 받습니다.</p>
                        </div>
                        <div className="setting-control">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    name="message"
                                    checked={settings.message}
                                    onChange={handleChange}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}
                >
                    {isLoading ? '저장 중...' : '저장'}
                </button>
            </form>

            <style jsx>{`
                .notify-settings {
                    margin-top: 8px;
                }

                .settings-list {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    margin-bottom: 24px;
                }

                .setting-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 16px;
                    border-bottom: 1px solid #e0e0e0;
                }

                .setting-item:last-child {
                    border-bottom: none;
                }

                .setting-info {
                    flex: 1;
                }

                .setting-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin: 0 0 4px 0;
                }

                .setting-description {
                    font-size: 14px;
                    color: #6c757d;
                    margin: 0;
                }

                .toggle {
                    position: relative;
                    display: inline-block;
                    width: 50px;
                    height: 24px;
                }

                .toggle input {
                    opacity: 0;
                    width: 0;
                    height: 0;
                }

                .toggle-slider {
                    position: absolute;
                    cursor: pointer;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: #ccc;
                    transition: .4s;
                    border-radius: 24px;
                }

                .toggle-slider:before {
                    position: absolute;
                    content: "";
                    height: 18px;
                    width: 18px;
                    left: 3px;
                    bottom: 3px;
                    background-color: white;
                    transition: .4s;
                    border-radius: 50%;
                }

                input:checked + .toggle-slider {
                    background-color: #4568dc;
                }

                input:focus + .toggle-slider {
                    box-shadow: 0 0 1px #4568dc;
                }

                input:checked + .toggle-slider:before {
                    transform: translateX(26px);
                }
            `}</style>
        </div>
    );
};

export default NotifySettings;
