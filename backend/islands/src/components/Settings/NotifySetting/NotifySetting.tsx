import { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const notifySettingsSchema = z.object({
    comment: z.boolean(),
    commentReply: z.boolean(),
    like: z.boolean(),
    follow: z.boolean(),
    message: z.boolean()
});

type NotifySettingInputs = z.infer<typeof notifySettingsSchema>;

const NotifySetting = () => {
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, reset } = useForm<NotifySettingInputs>({
        resolver: zodResolver(notifySettingsSchema),
        defaultValues: {
            comment: false,
            commentReply: false,
            like: false,
            follow: false,
            message: false
        }
    });

    useEffect(() => {
        const fetchNotifySetting = async () => {
            try {
                const { data } = await http('v1/setting/notify-config', { method: 'GET' });
                if (data.status === 'DONE') {
                    const settingsMap: { [key: string]: boolean } = {};
                    data.body.config.forEach((item: { name: string; value: string }) => {
                        // Map API names to form field names
                        if (item.name === 'notify_posts_comment') settingsMap.comment = item.value === 'True';
                        if (item.name === 'notify_comment_like') settingsMap.commentReply = item.value === 'True'; // Assuming this maps to commentReply
                        if (item.name === 'notify_posts_like') settingsMap.like = item.value === 'True';
                        if (item.name === 'notify_follow') settingsMap.follow = item.value === 'True';
                        // Assuming 'message' corresponds to a specific config type, if not, it will remain false
                        // For now, I'll assume there's no direct 'message' config and it will remain false
                    });
                    reset(settingsMap);
                } else {
                    notification('알림 설정을 불러오는데 실패했습니다.', { type: 'error' });
                }
            } catch (error) {
                notification('알림 설정을 불러오는데 실패했습니다.', { type: 'error' });
            }
        };
        fetchNotifySetting();
    }, [reset]);

    const onSubmit = async (formData: NotifySettingInputs) => {
        setIsLoading(true);

        try {
            const { data } = await http('v1/setting/notify-config', {
                method: 'PUT',
                data: {
                    notify_posts_comment: formData.comment ? 'True' : 'False',
                    notify_comment_like: formData.commentReply ? 'True' : 'False',
                    notify_posts_like: formData.like ? 'True' : 'False',
                    notify_follow: formData.follow ? 'True' : 'False'
                    // Assuming 'message' doesn't have a direct backend config, or needs to be added
                    // For now, it's not sent to the backend as there's no corresponding config type
                }
            });

            if (data.status === 'DONE') {
                notification('알림 설정이 업데이트 되었습니다.', { type: 'success' });
            } else {
                notification('알림 설정 업데이트에 실패했습니다.', { type: 'error' });
            }
        } catch (error) {
            notification('알림 설정 업데이트에 실패했습니다.', { type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="notify-settings">
            <form onSubmit={handleSubmit(onSubmit)}>
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
                                    {...register('comment')}
                                />
                                <span className="toggle-slider" />
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
                                    {...register('commentReply')}
                                />
                                <span className="toggle-slider" />
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
                                    {...register('like')}
                                />
                                <span className="toggle-slider" />
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
                                    {...register('follow')}
                                />
                                <span className="toggle-slider" />
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
                                    {...register('message')}
                                />
                                <span className="toggle-slider" />
                            </label>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isLoading}>
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

export default NotifySetting;
