import { WebhookChannelManager } from '../../components';
import {
    getWebhookChannels,
    addWebhookChannel,
    deleteWebhookChannel,
    testWebhook
} from '~/lib/api/settings';

const WebhookSetting = () => {
    return (
        <WebhookChannelManager
            queryKey={['webhook-channels']}
            title="웹훅 채널"
            description="내가 발행한 새 글을 등록된 채널로 자동 전송합니다."
            formTitle="새 웹훅 채널 추가"
            emptyTitle="등록된 웹훅 채널이 없습니다"
            emptyDescription="새 채널을 추가해서 내 글 발행 알림을 받아보세요."
            fetchChannels={getWebhookChannels}
            createChannel={addWebhookChannel}
            deleteChannel={deleteWebhookChannel}
            testChannel={testWebhook}
            confirmDeleteTitle="웹훅 채널 삭제"
            confirmDeleteMessage="정말 이 웹훅 채널을 삭제할까요?"
            addSuccessMessage="웹훅 채널이 추가되었습니다."
            addFailMessage="웹훅 채널 추가 중 오류가 발생했습니다."
            deleteSuccessMessage="웹훅 채널이 삭제되었습니다."
            deleteFailMessage="웹훅 채널 삭제에 실패했습니다."
        />
    );
};

export default WebhookSetting;
