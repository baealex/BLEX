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
            title="전역 채널"
            description="어떤 작성자가 새 글을 발행해도 등록된 채널로 자동 전송합니다."
            formTitle="새 전역 채널 추가"
            emptyTitle="등록된 전역 채널이 없습니다"
            emptyDescription="운영 채널을 추가해서 전체 발행 알림을 받아보세요."
            fetchChannels={getGlobalWebhookChannels}
            createChannel={addGlobalWebhookChannel}
            deleteChannel={deleteGlobalWebhookChannel}
            testChannel={testWebhook}
            confirmDeleteTitle="전역 채널 삭제"
            confirmDeleteMessage="정말 이 전역 채널을 삭제할까요?"
            addSuccessMessage="전역 채널이 추가되었습니다."
            addFailMessage="전역 채널 추가 중 오류가 발생했습니다."
            deleteSuccessMessage="전역 채널이 삭제되었습니다."
            deleteFailMessage="전역 채널 삭제에 실패했습니다."
        />
    );
};

export default GlobalWebhookSetting;
