import { WebhookChannelManager } from '../../components';
import {
    getGlobalWebhookChannels,
    addGlobalWebhookChannel,
    deleteGlobalWebhookChannel,
    testWebhook
} from '~/lib/api/settings';

const GlobalWebhookSetting = () => {
    return (
        <WebhookChannelManager
            queryKey={['global-webhook-channels']}
            title="전역 웹훅 연동"
            description="모든 작성자가 발행한 포스트를 Discord, Slack 또는 일반 웹훅 URL로 전송합니다."
            formTitle="새 전역 웹훅 추가"
            emptyTitle="등록된 전역 웹훅이 없습니다"
            emptyDescription="전송 대상을 추가해서 전체 발행 알림을 받아보세요."
            fetchChannels={getGlobalWebhookChannels}
            createChannel={addGlobalWebhookChannel}
            deleteChannel={deleteGlobalWebhookChannel}
            testChannel={testWebhook}
            confirmDeleteTitle="전역 웹훅 삭제"
            confirmDeleteMessage="정말 이 전역 웹훅을 삭제할까요?"
            addSuccessMessage="전역 웹훅이 추가되었습니다."
            addFailMessage="전역 웹훅 추가 중 오류가 발생했습니다."
            deleteSuccessMessage="전역 웹훅이 삭제되었습니다."
            deleteFailMessage="전역 웹훅 삭제에 실패했습니다."
        />
    );
};

export default GlobalWebhookSetting;
