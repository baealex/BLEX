import { useLingui } from '@lingui/react/macro';
import { WebhookChannelManager } from '../../components';
import {
    getWebhookChannels,
    addWebhookChannel,
    deleteWebhookChannel,
    testWebhook
} from '~/lib/api/settings';

const WebhookSetting = () => {
    const { t } = useLingui();

    return (
        <WebhookChannelManager
            queryKey={['webhook-channels']}
            title={t({
                id: 'settings.webhooks.user.title',
                message: 'Webhook integration'
            })}
            description={t({
                id: 'settings.webhooks.user.description',
                message: 'Send your newly published posts to Discord, Slack, or a generic webhook URL.'
            })}
            formTitle={t({
                id: 'settings.webhooks.user.form_title',
                message: 'Add webhook'
            })}
            emptyTitle={t({
                id: 'settings.webhooks.user.empty_title',
                message: 'No webhooks yet'
            })}
            fetchChannels={getWebhookChannels}
            createChannel={addWebhookChannel}
            deleteChannel={deleteWebhookChannel}
            testChannel={testWebhook}
            confirmDeleteTitle={t({
                id: 'settings.webhooks.user.delete.title',
                message: 'Delete webhook'
            })}
            confirmDeleteMessage={t({
                id: 'settings.webhooks.user.delete.message',
                message: 'Delete this webhook?'
            })}
            addSuccessMessage={t({
                id: 'settings.webhooks.user.add.success',
                message: 'Webhook added.'
            })}
            addFailMessage={t({
                id: 'settings.webhooks.user.add.failed',
                message: 'Could not add the webhook.'
            })}
            deleteSuccessMessage={t({
                id: 'settings.webhooks.user.delete.success',
                message: 'Webhook deleted.'
            })}
            deleteFailMessage={t({
                id: 'settings.webhooks.user.delete.failed',
                message: 'Could not delete the webhook.'
            })}
        />
    );
};

export default WebhookSetting;
