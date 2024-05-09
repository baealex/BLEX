import type { GetServerSideProps } from 'next';

import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { BaseInput, Button, Card, Flex, Text } from '~/components/design-system';
import { useFetch } from '~/hooks/use-fetch';

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
    const { data } = useFetch(['invitation', 'requests'], async () => {
        const { data } = await API.getInvitationRequests();
        return data.body?.length ? data.body : [];
    });

    return (
        <>
            <Text className="mb-3" fontSize={6} fontWeight={600}>에디터 초대 요청</Text>
            <Flex direction="column" gap={4}>
                {data?.map(invitation => (
                    <Card isRounded hasShadow className="p-3" key={invitation.sender}>
                        <Flex className="mb-3" gap={2} justify="between" align="center">
                            <Flex gap={2} align="center">
                                <img
                                    src={invitation.senderImage}
                                    width={56}
                                    height={56}
                                    style={{
                                        borderRadius: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                                <div>
                                    <Text fontWeight={600}>
                                        {invitation.sender}
                                    </Text>
                                </div>
                            </Flex>
                            <Flex gap={1}>
                                <Button color="transparent" onClick={() => { }}>
                                    거절
                                </Button>
                                <Button color="secondary" onClick={() => { }}>
                                    승낙
                                </Button>
                            </Flex>
                        </Flex>
                        <BaseInput tag="textarea" disabled value={invitation.content} />
                    </Card>
                ))}
            </Flex>
        </>
    );
};

InvitationSetting.pageLayout = (page) => (
    <SettingLayout active="invitation">
        {page}
    </SettingLayout>
);

export default InvitationSetting;
