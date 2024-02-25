import type { GetServerSideProps } from 'next';

import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { Card } from '~/components/design-system';

type Props = API.GetSettingNotifyResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
    const { data } = await API.getSettingNotify({ 'Cookie': req.headers.cookie || '' });

    if (data.status === 'ERROR') {
        return {
            redirect: {
                destination: '/',
                permanent: false
            }
        };
    }
    return { props: data.body };
};

const InvitationSetting: PageComponent<Props> = () => {
    return (
        <>
            <Card isRounded hasBackground className="p-3 mb-3">
                개발중인 기능입니다.
            </Card>
        </>
    );
};

InvitationSetting.pageLayout = (page) => (
    <SettingLayout active="invitation">
        {page}
    </SettingLayout>
);

export default InvitationSetting;
