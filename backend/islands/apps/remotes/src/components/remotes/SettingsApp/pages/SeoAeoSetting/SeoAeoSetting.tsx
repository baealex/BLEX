import { useEffect, useState } from 'react';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Toggle } from '@blex/ui/toggle';
import { Card } from '~/components/shared';
import { toast } from '~/utils/toast';
import { getSiteSettings, updateSiteSettings } from '~/lib/api/settings';
import { SettingsHeader } from '../../components';

const SeoAeoSetting = () => {
    const { data: settingData } = useSuspenseQuery({
        queryKey: ['site-settings'],
        queryFn: async () => {
            const { data } = await getSiteSettings();
            if (data.status === 'DONE') {
                return data.body;
            }
            throw new Error('SEO/AEO 설정을 불러오는데 실패했습니다.');
        }
    });

    const [aeoEnabled, setAeoEnabled] = useState(false);

    useEffect(() => {
        setAeoEnabled(settingData.aeoEnabled);
    }, [settingData]);

    const updateMutation = useMutation({
        mutationFn: (enabled: boolean) => updateSiteSettings({ aeo_enabled: enabled }),
        onSuccess: (_, enabled) => {
            setAeoEnabled(enabled);
            toast.success('SEO/AEO 설정이 저장되었습니다.');
        },
        onError: () => {
            setAeoEnabled(settingData.aeoEnabled);
            toast.error('SEO/AEO 설정 저장에 실패했습니다.');
        }
    });

    const handleAeoChange = (enabled: boolean) => {
        setAeoEnabled(enabled);
        updateMutation.mutate(enabled);
    };

    return (
        <div className="space-y-8">
            <SettingsHeader
                title="SEO/AEO"
                description="검색엔진과 인공지능 에이전트 노출 정책을 관리합니다."
            />

            <Card
                title="AEO(인공지능 노출)"
                subtitle="llms.txt, Markdown endpoint, discovery header 공개 여부를 제어합니다."
                icon={<i className="fas fa-robot" />}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <div className="text-sm font-semibold text-content">AEO 활성화</div>
                        <p className="text-xs leading-relaxed text-content-secondary">
                            켜면 AI용 진입점과 Markdown 노출 표면이 함께 열립니다.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-content-secondary">
                            {aeoEnabled ? 'ON' : 'OFF'}
                        </span>
                        <Toggle
                            checked={aeoEnabled}
                            disabled={updateMutation.isPending}
                            onCheckedChange={handleAeoChange}
                            aria-label="AEO 인공지능 노출 활성화"
                        />
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default SeoAeoSetting;
