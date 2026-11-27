import { Trans, useLingui } from '@lingui/react/macro';
import { SettingsHeader, SettingsHeaderAction } from '../layout';
import { DraftPostListContent } from '../posts/components';
import { navigateTo } from '~/application/navigation';

const DraftsSetting = () => {
    const { t } = useLingui();

    return (
        <div>
            <SettingsHeader
                title={t({
                    id: 'settings.posts.tabs.drafts',
                    message: 'Drafts'
                })}
                actionPosition="right"
                action={
                    <SettingsHeaderAction variant="primary" onClick={() => navigateTo('/write')}>
                        <Trans id="settings.posts.create">Write a new post</Trans>
                    </SettingsHeaderAction>
                }
            />

            <DraftPostListContent />
        </div>
    );
};

export default DraftsSetting;
