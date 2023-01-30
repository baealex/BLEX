import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useStore } from 'badland-react';

import { Button, Card } from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';

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

    const handleUnsyncTelegram = async () => {
        if (confirm(message('CONFIRM', '정말 연동을 해제할까요?'))) {
            const { data } = await API.postTelegram('unsync');
            if (data.status === 'ERROR') {
                snackBar(message('AFTER_REQ_ERR', data.errorMessage));
                return;
            }
            snackBar(message('AFTER_REQ_DONE', '연동이 해제되었습니다.'));
            setAuth((prevState) => ({
                ...prevState,
                isTelegramSync: false
            }));
        }
    };

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
            {auth.isTelegramSync ? (
                <Button
                    space="spare"
                    display="block"
                    onClick={handleUnsyncTelegram}>
                    <i className="fab fa-telegram-plane"/> 텔레그램 연동 해제
                </Button>
            ) : (
                <Button
                    space="spare"
                    display="block"
                    onClick={() => modalStore.open('isTelegramSyncModalOpen')}>
                    <i className="fab fa-telegram-plane"/> 텔레그램 연동
                </Button>
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
