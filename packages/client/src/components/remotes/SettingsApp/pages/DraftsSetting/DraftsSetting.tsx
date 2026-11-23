import { Trans, useLingui } from '@lingui/react/macro';
import { SettingsHeader, SettingsHeaderAction } from '../../components';
import { DraftPostListContent } from '../PostsSetting/components';

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
                    <SettingsHeaderAction
                        variant="primary"
                        onClick={() => window.location.assign('/write')}>
                        <Trans id="settings.posts.create">Write a new post</Trans>
                    </SettingsHeaderAction>
                }
            />

            <DraftPostListContent />
        </div>
    );
};

export default DraftsSetting;
