import { ScopedBannerSetting } from '../../components';
import {
    getGlobalBanners,
    createGlobalBanner,
    updateGlobalBanner,
    deleteGlobalBanner,
    updateGlobalBannerOrder,
    type GlobalBannerData,
    type GlobalBannerCreateData,
    type GlobalBannerUpdateData
} from '~/lib/api/settings';
import { GlobalBannerForm, GlobalBannerList } from './components';

const GlobalBannerSetting = () => {
    return (
        <ScopedBannerSetting<GlobalBannerData, GlobalBannerCreateData, GlobalBannerUpdateData>
            queryKey={['global-banners']}
            title="글로벌 배너"
            description="사이트 전체에 표시되는 글로벌 배너를 관리합니다. 드래그하여 순서를 변경할 수 있습니다."
            emptyIconClassName="fas fa-rectangle-ad"
            emptyTitle="등록된 글로벌 배너가 없습니다"
            emptyDescription="첫 번째 글로벌 배너를 만들어보세요."
            modalCreateTitle="새 글로벌 배너 만들기"
            modalEditTitle="글로벌 배너 수정"
            createButtonLabel="새 배너 추가"
            deleteConfirmTitle="글로벌 배너 삭제"
            deleteConfirmMessage="정말로 이 글로벌 배너를 삭제하시겠습니까?"
            createSuccessMessage="글로벌 배너가 생성되었습니다."
            createErrorMessage="글로벌 배너 생성에 실패했습니다."
            updateSuccessMessage="글로벌 배너가 수정되었습니다."
            updateErrorMessage="글로벌 배너 수정에 실패했습니다."
            deleteSuccessMessage="글로벌 배너가 삭제되었습니다."
            deleteErrorMessage="글로벌 배너 삭제에 실패했습니다."
            reorderSuccessMessage="글로벌 배너 순서가 변경되었습니다."
            reorderErrorMessage="글로벌 배너 순서 변경에 실패했습니다."
            fetchBanners={getGlobalBanners}
            createBanner={createGlobalBanner}
            updateBanner={updateGlobalBanner}
            deleteBanner={deleteGlobalBanner}
            reorderBanners={updateGlobalBannerOrder}
            toTogglePayload={(banner) => ({ is_active: !banner.isActive })}
            toUpdatePayload={(data) => data}
            FormComponent={GlobalBannerForm}
            ListComponent={GlobalBannerList}
        />
    );
};

export default GlobalBannerSetting;
