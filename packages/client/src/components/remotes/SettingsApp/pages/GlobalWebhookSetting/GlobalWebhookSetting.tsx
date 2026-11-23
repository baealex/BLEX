import { useLingui } from '@lingui/react/macro';
import { WebhookChannelManager } from '../../components';
import {
    getGlobalWebhookChannels,
    addGlobalWebhookChannel,
    deleteGlobalWebhookChannel,
    testWebhook
} from '~/lib/api/settings';

const GlobalWebhookSetting = () => {
    const { t } = useLingui();

    return (
        <WebhookChannelManager
            queryKey={['global-webhook-channels']}
            title={t({
                id: 'settings.webhooks.global.title',
                message: 'Global webhook integration'
            })}
            description={t({
                id: 'settings.webhooks.global.description',
                message: 'Send posts published by any author to Discord, Slack, or a generic webhook URL.'
            })}
            formTitle={t({
                id: 'settings.webhooks.global.form_title',
                message: 'Add global webhook'
            })}
            emptyTitle={t({
                id: 'settings.webhooks.global.empty_title',
                message: 'No global webhooks yet'
            })}
            fetchChannels={getGlobalWebhookChannels}
            createChannel={addGlobalWebhookChannel}
            deleteChannel={deleteGlobalWebhookChannel}
            testChannel={testWebhook}
            confirmDeleteTitle={t({
                id: 'settings.webhooks.global.delete.title',
                message: 'Delete global webhook'
            })}
            confirmDeleteMessage={t({
                id: 'settings.webhooks.global.delete.message',
                message: 'Delete this global webhook?'
            })}
            addSuccessMessage={t({
                id: 'settings.webhooks.global.add.success',
                message: 'Global webhook added.'
            })}
            addFailMessage={t({
                id: 'settings.webhooks.global.add.failed',
                message: 'Could not add the global webhook.'
            })}
            deleteSuccessMessage={t({
                id: 'settings.webhooks.global.delete.success',
                message: 'Global webhook deleted.'
            })}
            deleteFailMessage={t({
                id: 'settings.webhooks.global.delete.failed',
                message: 'Could not delete the global webhook.'
            })}
        />
    );
};

export default GlobalWebhookSetting;
