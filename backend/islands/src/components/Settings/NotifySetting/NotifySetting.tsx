import { useState, useEffect } from 'react';
import { http } from '~/modules/http.module';
import { notification } from '@baejino/ui';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const notifySettingsSchema = z.object({
    NOTIFY_POSTS_LIKE: z.boolean(),
    NOTIFY_POSTS_COMMENT: z.boolean(),
    NOTIFY_POSTS_THANKS: z.boolean(),
    NOTIFY_POSTS_NO_THANKS: z.boolean(),
    NOTIFY_COMMENT_LIKE: z.boolean(),
    NOTIFY_FOLLOW: z.boolean(),
    NOTIFY_MENTION: z.boolean()
});

type NotifySettingInputs = z.infer<typeof notifySettingsSchema>;

const NotifySetting = () => {
    const [isLoading, setIsLoading] = useState(false);

    const { register, handleSubmit, reset } = useForm<NotifySettingInputs>({
        resolver: zodResolver(notifySettingsSchema),
        defaultValues: {
            NOTIFY_POSTS_LIKE: false,
            NOTIFY_POSTS_COMMENT: false,
            NOTIFY_POSTS_THANKS: false,
            NOTIFY_POSTS_NO_THANKS: false,
            NOTIFY_COMMENT_LIKE: false,
            NOTIFY_FOLLOW: false,
            NOTIFY_MENTION: false
        }
    });

    useEffect(() => {
        const fetchNotifySetting = async () => {
            try {
                const { data } = await http('v1/setting/notify-config', { method: 'GET' });
                if (data.status === 'DONE') {
                    const settingsMap: { [key: string]: boolean } = {};
                    data.body.config.forEach((item: { name: string; value: boolean }) => {
                        settingsMap[item.name] = item.value;
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
                data: formData
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
        <div className="p-6 bg-white shadow-md rounded-lg">
            <form onSubmit={handleSubmit(onSubmit)}>
                <div className="space-y-6 mb-6">
                    <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">포스트 좋아요 알림</h3>
                            <p className="text-sm text-gray-500">내 포스트에 좋아요가 달릴 때 알림을 받습니다.</p>
                        </div>
                        <div className="ml-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    {...register('NOTIFY_POSTS_LIKE')}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">포스트 댓글 알림</h3>
                            <p className="text-sm text-gray-500">내 포스트에 댓글이 달릴 때 알림을 받습니다.</p>
                        </div>
                        <div className="ml-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    {...register('NOTIFY_POSTS_COMMENT')}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">포스트 감사 알림</h3>
                            <p className="text-sm text-gray-500">내 포스트에 감사 표시가 달릴 때 알림을 받습니다.</p>
                        </div>
                        <div className="ml-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    {...register('NOTIFY_POSTS_THANKS')}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">포스트 비감사 알림</h3>
                            <p className="text-sm text-gray-500">내 포스트에 비감사 표시가 달릴 때 알림을 받습니다.</p>
                        </div>
                        <div className="ml-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    {...register('NOTIFY_POSTS_NO_THANKS')}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">댓글 좋아요 알림</h3>
                            <p className="text-sm text-gray-500">내 댓글에 좋아요가 달릴 때 알림을 받습니다.</p>
                        </div>
                        <div className="ml-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    {...register('NOTIFY_COMMENT_LIKE')}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">팔로우 알림</h3>
                            <p className="text-sm text-gray-500">새로운 팔로워가 생길 때 알림을 받습니다.</p>
                        </div>
                        <div className="ml-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    {...register('NOTIFY_FOLLOW')}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>

                    <div className="flex justify-between items-center">
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 mb-1">멘션 알림</h3>
                            <p className="text-sm text-gray-500">누군가 나를 멘션할 때 알림을 받습니다.</p>
                        </div>
                        <div className="ml-4">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    {...register('NOTIFY_MENTION')}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isLoading}
                >
                    {isLoading ? '저장 중...' : '저장'}
                </button>
            </form>
        </div>
    );
};

export default NotifySetting;
