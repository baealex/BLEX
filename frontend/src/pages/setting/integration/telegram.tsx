import { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useStore } from 'badland-react';

import { Button, Card, Flex, Text } from '~/components/design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '~/components/system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';

type Props = API.GetSettingIntegrationTelegramResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
    const { data } = await API.getSettingIntegrationTelegram({
        'Cookie': req.headers.cookie || ''
    });

    if (data.status === 'ERROR') {
        return {
            redirect: {
                destination: '/',
                permanent: false
            }
        };
    }
    return {
        props: data.body
    };
};

const SettingIntegrationTelegram: PageComponent<Props> = (props: Props) => {
    const [, setAuth] = useStore(authStore);
    const [token, setToken] = useState('');

    const handleDisconnectTelegram = async () => {
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

    useEffect(() => {
        if (props.isConnected || token) {
            return;
        }
        API.postTelegram('makeToken').then(({ data }) => {
            if (data.status === 'ERROR') {
                snackBar(message('AFTER_REQ_ERR', data.errorMessage));
                return;
            }
            setToken(data.body.token || '');
        });
    }, [props.isConnected, token]);

    return (
        <>
            <Card className="p-3" isRounded hasBackground>
                <div
                    style={{
                        lineHeight: '1.75'
                    }}>
                    <>
                        <div>
                            <b>텔레그램과 연동하면 어떤 효과가 있나요?</b>
                        </div>
                        <ul>
                            <li>실시간으로 회원님의 알림을 전달해 드립니다.</li>
                            <li>로그인시 2차 인증을 사용할 수 있습니다.</li>
                        </ul>
                    </>
                    {!props.isConnected && (
                        <>
                            <div className="my-3">
                                <b>어떻게 연동하나요?</b>
                                <ul>
                                    <li>텔레그램을 실행하고 <a href="http://t.me/blex_bot" className="shallow-dark">@blex_bot</a>을 추가해주세요!</li>
                                    <li>봇에게 <code
                                        style={{
                                            fontWeight: '600',
                                            background: '#A076F1',
                                            color: '#fff',
                                            padding: '2px 4px',
                                            borderRadius: '4px'
                                        }}>{token}</code>을 전송해주세요!</li>
                                </ul>
                            </div>
                            해당 토큰은 회원님을 위해 생성된 일회성 토큰이며 연동을 완료되거나 오늘이 지나면 파기됩니다.
                        </>
                    )}
                </div>
            </Card>
            {props.isConnected && (
                <Card className="mt-3 p-3" isRounded hasBackground>
                    <Flex align="center" justify="between" wrap="wrap">
                        <div>
                            <Flex justify="center">
                                <i className="fab fa-telegram-plane text-2xl mr-2" />
                                <Text tag="span" fontWeight={600}>연동된 아이디</Text>
                            </Flex>
                            <div className="mt-2">
                                <span className="text-lg">{props.telegramId}</span>
                            </div>
                        </div>
                    </Flex>
                    <Button
                        display="block"
                        className="mt-3"
                        onClick={handleDisconnectTelegram}>
                        연동 해제
                    </Button>
                </Card >
            )}
        </>
    );
};

SettingIntegrationTelegram.pageLayout = (page) => (
    <SettingLayout active="integration/telegram">
        {page}
    </SettingLayout>
);

export default SettingIntegrationTelegram;
