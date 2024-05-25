import { useState } from 'react';
import { useStore } from 'badland-react';

import {
    BaseInput, Button, Card, Container, Flex, Modal, Text
} from '~/components/design-system';

import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';
import { useFetch } from '~/hooks/use-fetch';

import * as API from '~/modules/api';

import { authStore } from '~/stores/auth';

const Invitation = () => {
    const [isOpenRequestModal, setIsOpenRequestModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState('');
    const [requestContent, setRequestContent] = useState('');

    const [authState] = useStore(authStore);

    const { data } = useFetch(['invitation', 'owners'], async () => {
        const { data } = await API.getInvitationOwners();
        return data.body;
    });

    const handleClickRequest = (username: string) => {
        if (authState.hasEditorRole) {
            snackBar(message('BEFORE_REQ_ERR', '이미 에디터로 초대되었습니다.'));
            return;
        }
        setSelectedUser(username);
        setIsOpenRequestModal(true);
    };

    const handleSubmit = async () => {
        if (!selectedUser) {
            snackBar(message('BEFORE_REQ_ERR', '선택된 유저가 없어요.'));
            return;
        }
        if (!requestContent) {
            snackBar(message('BEFORE_REQ_ERR', '내용을 입력해 주세요.'));
            return;
        }
        const { data } = await API.createRequestInvitation({
            receiver: selectedUser,
            content: requestContent
        });
        if (data.status === 'ERROR') {
            snackBar(message('AFTER_REQ_ERR', data.errorMessage));
            return;
        }
        snackBar(message('AFTER_REQ_DONE', '요청이 완료되었습니다.'));
        setIsOpenRequestModal(false);
    };

    return (
        <Container size="sm">
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
                            <Button onClick={() => handleClickRequest(user)}>
                                초대장 요청
                            </Button>
                        </Flex>
                    </Card>
                ))}
            </Flex>
            <Modal
                title="초대장 요청"
                isOpen={isOpenRequestModal}
                onClose={() => {
                    setRequestContent('');
                    setIsOpenRequestModal(false);
                }}
                submitText="요청 보내기"
                onSubmit={handleSubmit}>
                <Flex style={{ width: '100%' }} direction="column" gap={3}>
                    <BaseInput
                        disabled
                        tag="input"
                        value={selectedUser}
                    />
                    <BaseInput
                        tag="textarea"
                        value={requestContent}
                        onChange={(e) => setRequestContent(e.currentTarget.value)}
                        placeholder="내용을 입력하세요."
                    />
                </Flex>
            </Modal>
        </Container>
    );
};

export default Invitation;
