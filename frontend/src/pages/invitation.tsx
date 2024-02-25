import type { GetServerSideProps } from 'next';

import { Button, Card, Flex, Text } from '~/components/design-system';
import { useFetch } from '~/hooks/use-fetch';

import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import * as API from '~/modules/api';

type Props = API.GetPostsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
    try {
        const { data } = await API.getPopularPosts(1, context.req.headers.cookie);

        return {
            props: {
                ...data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

const Invitation = () => {
    const { data } = useFetch(['invitation', 'owners'], async () => {
        const { data } = await API.getInvitationOwners();
        return data.body;
    });

    const handleClickRequest = () => {
        snackBar(message('BEFORE_REQ_ERR', '개발중인 기능입니다.'));
    };

    return (
        <div className="x-container">
            <Card isRounded hasShadow className="p-3 mb-3">
                <Text tag="h2" fontSize={6} fontWeight={600} className="mb-2">
                    <Flex gap={2} align="center">
                        <i className="fas fa-user-plus" />
                        초대장 필요
                    </Flex>
                </Text>
                <p>블렉스의 에디터가 되려면 다른 에디터의 초대를 받아야 합니다.</p>
                <p>아래 초대장을 보유한 에디터에게 초대장을 요청해 보세요!</p>
            </Card>
            <Flex gap={3} direction="column">
                {data?.map(({ user, userImage, userDescription }) => (
                    <Card isRounded hasShadow className="p-3" key={user}>
                        <Flex gap={2} justify="between" align="center">
                            <Flex gap={2} align="center">
                                <img
                                    src={userImage}
                                    width={56}
                                    height={56}
                                    style={{
                                        borderRadius: '100%',
                                        objectFit: 'cover'
                                    }}
                                />
                                <div>
                                    <Text fontWeight={600}>
                                        {user}
                                    </Text>
                                    <Text>
                                        {userDescription || '사용자가 작성한 설명이 없습니다.'}
                                    </Text>
                                </div>
                            </Flex>
                            <Button onClick={handleClickRequest}>
                                초대장 요청
                            </Button>
                        </Flex>
                    </Card>
                ))}
            </Flex>
        </div >
    );
};

export default Invitation;
