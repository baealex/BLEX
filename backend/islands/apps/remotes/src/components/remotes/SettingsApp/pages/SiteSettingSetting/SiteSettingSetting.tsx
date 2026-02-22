import { useState, useEffect } from 'react';
import { toast } from '~/utils/toast';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { SettingsHeader } from '../../components';
import { Button, Card, Input } from '~/components/shared';
import { CodeEditor } from '~/components/CodeEditor';
import {
    getSiteSettings,
    updateSiteSettings,
    type SiteSettingUpdateData
} from '~/lib/api/settings';

const SiteSettingSetting = () => {
    const { data: settingData } = useSuspenseQuery({
        queryKey: ['site-settings'],
        queryFn: async () => {
            const { data } = await getSiteSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('사이트 설정을 불러오는데 실패했습니다.');
        }
    });

    const [headerScript, setHeaderScript] = useState('');
    const [footerScript, setFooterScript] = useState('');
    const [welcomeMessage, setWelcomeMessage] = useState('');
    const [welcomeUrl, setWelcomeUrl] = useState('');
    const [deletionRedirectUrl, setDeletionRedirectUrl] = useState('');

    useEffect(() => {
        if (settingData) {
            setHeaderScript(settingData.headerScript);
            setFooterScript(settingData.footerScript);
            setWelcomeMessage(settingData.welcomeNotificationMessage);
            setWelcomeUrl(settingData.welcomeNotificationUrl);
            setDeletionRedirectUrl(settingData.accountDeletionRedirectUrl);
        }
    }, [settingData]);

    const updateMutation = useMutation({
        mutationFn: (data: SiteSettingUpdateData) => updateSiteSettings(data),
        onSuccess: () => {
            toast.success('사이트 설정이 저장되었습니다.');
        },
        onError: () => {
            toast.error('사이트 설정 저장에 실패했습니다.');
        }
    });

    const handleSave = () => {
        updateMutation.mutate({
            header_script: headerScript,
            footer_script: footerScript,
            welcome_notification_message: welcomeMessage,
            welcome_notification_url: welcomeUrl,
            account_deletion_redirect_url: deletionRedirectUrl
        });
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="사이트 설정"
                description="사이트 전체에 적용되는 커스텀 코드 및 알림 설정을 관리합니다."
            />

            <Card
                title="커스텀 코드"
                subtitle="스크립트나 메타 태그와 같은 코드를 전역에 삽입할 수 있습니다."
                icon={<i className="fas fa-code" />}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                            Head 영역 코드
                        </label>
                        <CodeEditor
                            language="html"
                            value={headerScript}
                            onChange={setHeaderScript}
                            height="200px"
                        />
                        <p className="text-xs text-gray-500">{'<head>'} 태그 안에 삽입됩니다.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                            Body 하단 코드
                        </label>
                        <CodeEditor
                            language="html"
                            value={footerScript}
                            onChange={setFooterScript}
                            height="200px"
                        />
                        <p className="text-xs text-gray-500">{'</body>'} 태그 직전에 삽입됩니다.</p>
                    </div>
                </div>
            </Card>

            <Card
                title="회원가입 알림"
                subtitle="새로운 회원 가입 시 발송되는 환영 알림을 설정합니다."
                icon={<i className="fas fa-bell" />}>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                            환영 메시지
                        </label>
                        <Input
                            multiline
                            rows={3}
                            placeholder="환영합니다, {name}님! BLEX에 오신 것을 환영합니다."
                            value={welcomeMessage}
                            onChange={(e) => setWelcomeMessage(e.target.value)}
                            className="text-sm"
                        />
                        <p className="text-xs text-gray-500">{'{name}'}을 사용하면 사용자 이름으로 치환됩니다.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-900">
                            알림 클릭 URL
                        </label>
                        <Input
                            placeholder="/"
                            value={welcomeUrl}
                            onChange={(e) => setWelcomeUrl(e.target.value)}
                            className="text-sm"
                        />
                        <p className="text-xs text-gray-500">환영 알림 클릭 시 이동할 URL입니다.</p>
                    </div>
                </div>
            </Card>

            <Card
                title="회원 탈퇴 설정"
                subtitle="회원 탈퇴 시 리다이렉트 설정입니다."
                icon={<i className="fas fa-user-minus" />}>
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-900">
                        탈퇴 후 리다이렉트 URL
                    </label>
                    <Input
                        placeholder="https://forms.example.com/exit-survey"
                        value={deletionRedirectUrl}
                        onChange={(e) => setDeletionRedirectUrl(e.target.value)}
                        className="text-sm"
                    />
                    <p className="text-xs text-gray-500">비워두면 메인 페이지로 이동합니다. 설문 링크 등을 설정할 수 있습니다.</p>
                </div>
            </Card>

            <div className="flex justify-end">
                <Button
                    variant="primary"
                    size="md"
                    isLoading={updateMutation.isPending}
                    onClick={handleSave}
                    leftIcon={
                        !updateMutation.isPending ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        ) : undefined
                    }>
                    {updateMutation.isPending ? '저장 중...' : '저장'}
                </Button>
            </div>
        </div>
    );
};

export default SiteSettingSetting;
