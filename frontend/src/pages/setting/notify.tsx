import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useStore } from 'badland-react';

import { Alert, Button, Card, Flex, Modal, Toggle } from '~/components/design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '~/components/system-design/setting';

import * as API from '~/modules/api';

import { authStore } from '~/stores/auth';
import { useFetch } from '~/hooks/use-fetch';
import { useState } from 'react';

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

const NOTIFY_CONFIG_LABEL = {
    'NOTIFY_POSTS_LIKE': '다른 사용자가 내 글 추천',
    'NOTIFY_POSTS_THANKS': '방문자가 내 글에 도움됐어요 평가',
    'NOTIFY_POSTS_NO_THANKS': '방문자가 내 글에 도움안돼요 평가',
    'NOTIFY_POSTS_COMMENT': '다른 사용자가 내 글에 댓글 작성',
    'NOTIFY_COMMENT_LIKE': '다른 사용자가 내 댓글 추천',
    'NOTIFY_FOLLOW': '다른 사용자가 나를 팔로우',
    'NOTIFY_MENTION': '다른 사용자가 댓글에서 나를 언급'
} as const;

const FormsSetting: PageComponent<Props> = (props) => {
    const router = useRouter();

    const [auth, setAuth] = useStore(authStore);

    const [isOpenConfig, setIsOpenConfig] = useState(false);

    const { data: notifyConfig, mutate } = useFetch(['setting', 'notify', 'config'], async () => {
        const { data: { body } } = await API.getSettingNotifyConfig();
        return body.config;
    });

    const handleClickNotify = async ({ id, url, isRead }: Props['notify'][number]) => {
        if (!isRead) {
            const { data } = await API.putSetting('notify', { id });
            if (data.status === 'DONE') {
                setAuth((prevState) => ({
                    ...prevState,
                    notifyCount: prevState.notifyCount - 1
                }));
            }
        }
        router.push(url);
    };

    const handleToggleConfig = async (name: keyof typeof NOTIFY_CONFIG_LABEL) => {
        if (!notifyConfig) {
            return;
        }

        const nextState = notifyConfig.map((item) => {
            if (item.name === name) {
                return {
                    ...item,
                    value: !item.value
                };
            }
            return item;
        });

        await API.putSetting('notify-config', nextState?.reduce<Record<string, boolean>>((acc, cur) => {
            return {
                ...acc,
                [cur.name]: cur.value
            };
        }, {}));

        mutate(nextState!);
    };

    return (
        <>
            {!auth.hasConnectedTelegram && (
                <Alert type="information" onClick={() => router.push('/setting/integration/telegram')}>
                    <i className="fab fa-telegram-plane" /> 텔레그램을 연동하여 실시간 알림을 받아보세요.
                </Alert>
            )}
            <Flex justify="end" className="my-3">
                <Button onClick={() => setIsOpenConfig(true)}>
                    <i className="fas fa-cog" /> 알림 설정
                </Button>
            </Flex>
            <div className="mt-3">
                {props.notify.map((item) => (
                    <Card key={item.id} hasBackground isRounded className="p-3 mb-3">
                        <a style={{ opacity: item.isRead ? 0.4 : 1 }} onClick={() => handleClickNotify(item)}>
                            {item.content}
                            <div className={'ns'}>
                                {item.createdDate}
                            </div>
                        </a>
                    </Card>
                ))}
            </div>
            <Modal title="알림 설정" isOpen={isOpenConfig} onClose={() => setIsOpenConfig(false)}>
                {notifyConfig && (
                    <Flex direction="column" gap={3}>
                        {notifyConfig.map((item) => (
                            <Toggle
                                key={item.name}
                                label={NOTIFY_CONFIG_LABEL[item.name]}
                                defaultChecked={item.value}
                                onClick={() => handleToggleConfig(item.name)}
                            />
                        ))}
                    </Flex>
                )}
            </Modal>
        </>
    );
};

FormsSetting.pageLayout = (page) => (
    <SettingLayout active="notify">
        {page}
    </SettingLayout>
);

export default FormsSetting;
