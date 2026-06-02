import { SettingsHeader } from '../../components';
import { Button } from '~/components/shared';
import { DraftPostListContent } from '../PostsSetting/components';

const DraftsSetting = () => {
    return (
        <div>
            <SettingsHeader
                title="임시 포스트"
                description="작성 중인 임시 포스트를 이어서 작성하거나 삭제할 수 있습니다."
                actionPosition="right"
                action={
                    <Button
                        variant="primary"
                        size="md"
                        className="w-full sm:w-auto"
                        onClick={() => window.location.assign('/write')}>
                        새 포스트 작성
                    </Button>
                }
            />

            <DraftPostListContent />
        </div>
    );
};

export default DraftsSetting;
