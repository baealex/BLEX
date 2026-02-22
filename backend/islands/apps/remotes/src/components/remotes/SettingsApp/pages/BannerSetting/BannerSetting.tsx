import { ScopedBannerSetting } from '../../components';
import {
    getBanners,
    createBanner,
    updateBanner,
    deleteBanner,
    updateBannerOrder,
    type BannerData,
    type BannerCreateData,
    type BannerUpdateData
} from '~/lib/api/settings';
import { BannerForm } from './components/BannerForm';
import { BannerList } from './components/BannerList';

const BannerSetting = () => {
    return (
        <ScopedBannerSetting<BannerData, BannerCreateData, BannerUpdateData>
            queryKey={['banners']}
            title="배너"
            description="블로그의 상단, 하단, 사이드바에 표시될 배너를 관리합니다. 드래그하여 순서를 변경할 수 있습니다."
            emptyIconClassName="fas fa-shapes"
            emptyTitle="등록된 배너가 없습니다"
            emptyDescription="첫 번째 배너를 만들어보세요."
            modalCreateTitle="새 배너 만들기"
            modalEditTitle="배너 수정"
            createButtonLabel="새 배너 추가"
            deleteConfirmTitle="배너 삭제"
            deleteConfirmMessage="정말로 이 배너를 삭제하시겠습니까?"
            createSuccessMessage="배너가 생성되었습니다."
            createErrorMessage="배너 생성에 실패했습니다."
            updateSuccessMessage="배너가 수정되었습니다."
            updateErrorMessage="배너 수정에 실패했습니다."
            deleteSuccessMessage="배너가 삭제되었습니다."
            deleteErrorMessage="배너 삭제에 실패했습니다."
            reorderSuccessMessage="배너 순서가 변경되었습니다."
            reorderErrorMessage="배너 순서 변경에 실패했습니다."
            fetchBanners={getBanners}
            createBanner={createBanner}
            updateBanner={updateBanner}
            deleteBanner={deleteBanner}
            reorderBanners={updateBannerOrder}
            toTogglePayload={(banner) => ({ is_active: !banner.isActive })}
            toUpdatePayload={(data) => data}
            FormComponent={BannerForm}
            ListComponent={BannerList}
        />
    );
};

export default BannerSetting;
