import { SettingsHeader, SettingsHeaderAction } from '../../components';
import { DraftPostListContent } from '../PostsSetting/components';

const DraftsSetting = () => {
    return (
        <div>
            <SettingsHeader
                title="임시 포스트"
                actionPosition="right"
                action={
                    <SettingsHeaderAction
                        variant="primary"
                        onClick={() => window.location.assign('/write')}>
                        새 포스트 작성
                    </SettingsHeaderAction>
                }
            />

            <DraftPostListContent />
        </div>
    );
};

export default DraftsSetting;
