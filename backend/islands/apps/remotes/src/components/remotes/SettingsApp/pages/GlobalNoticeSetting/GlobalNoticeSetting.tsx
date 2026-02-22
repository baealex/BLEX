import { ScopedNoticeSetting } from '../../components';
import {
    getGlobalNotices,
    createGlobalNotice,
    updateGlobalNotice,
    deleteGlobalNotice,
    type GlobalNoticeData,
    type GlobalNoticeCreateData,
    type GlobalNoticeUpdateData
} from '~/lib/api/settings';

const GlobalNoticeSetting = () => {
    return (
        <ScopedNoticeSetting<GlobalNoticeData, GlobalNoticeCreateData, GlobalNoticeUpdateData>
            queryKey={['global-notices']}
            title="공지 관리"
            description="사이트 전체에 표시되는 글로벌 공지를 관리합니다."
            emptyTitle="등록된 공지가 없습니다"
            emptyDescription="첫 번째 공지를 만들어보세요."
            activeDescription="활성화된 공지만 사용자에게 표시됩니다."
            fetchNotices={getGlobalNotices}
            createNotice={createGlobalNotice}
            updateNotice={updateGlobalNotice}
            deleteNotice={deleteGlobalNotice}
            toCreateData={({ title, url, isActive }) => ({
                title,
                url,
                is_active: isActive
            })}
            toUpdateData={({ title, url, isActive }) => ({
                title,
                url,
                is_active: isActive
            })}
            toggleUpdateData={(notice) => ({
                is_active: !notice.isActive
            })}
            createSuccessMessage="공지가 생성되었습니다."
            createErrorMessage="공지 생성에 실패했습니다."
            updateSuccessMessage="공지가 수정되었습니다."
            updateErrorMessage="공지 수정에 실패했습니다."
            deleteSuccessMessage="공지가 삭제되었습니다."
            deleteErrorMessage="공지 삭제에 실패했습니다."
            deleteConfirmTitle="공지 삭제"
            deleteConfirmMessage="정말로 이 공지를 삭제하시겠습니까?"
            actionLabel="새 공지 추가"
        />
    );
};

export default GlobalNoticeSetting;
