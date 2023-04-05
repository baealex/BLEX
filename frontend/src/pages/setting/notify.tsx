import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useStore } from 'badland-react';

import { Alert, Card } from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';

import { authStore } from '~/stores/auth';

type Props = API.GetSettingNotifyResponseData;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
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

const FormsSetting: PageComponent<Props> = (props) => {
    const router = useRouter();
    const [auth, setAuth] = useStore(authStore);

    const handleClickNotify = async ({ pk, url, isRead }: Props['notify'][0]) => {
        if (!isRead) {
            const { data } = await API.putSetting('notify', { pk });
            if (data.status === 'DONE') {
                setAuth((prevState) => ({
                    ...prevState,
                    notifyCount: prevState.notifyCount - 1
                }));
            }
        }
        router.push(url);
    };

    return (
        <>
            {!auth.isTelegramSync && (
                <Alert type="information" onClick={() => router.push('/setting/integration/telegram')}>
                    <i className="fab fa-telegram-plane"/> 텔레그램 연동을 연동하여 알림을 받아보세요.
                </Alert>
            )}
            <div className="mt-3">
                {props.notify.map((item) => (
                    <Card key={item.pk} hasBackground isRounded className="p-3 mb-3">
                        <a style={{ opacity: item.isRead ? 0.4 : 1 }} onClick={() => handleClickNotify(item)}>
                            {item.content}
                            <div className={'ns'}>
                                {item.createdDate}
                            </div>
                        </a>
                    </Card>
                ))}
            </div>
        </>
    );
};

FormsSetting.pageLayout = (page) => (
    <SettingLayout active="notify">
        {page}
    </SettingLayout>
);

export default FormsSetting;
