import React, { useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useValue } from 'badland-react';

import {
    Alert,
    Button,
    Card,
    Flex,
    Text
} from '~/components/design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '~/components/system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';

import { useDidMount } from '~/hooks/use-life-cycle';
import { useForm } from '~/hooks/use-form';

type Props = API.GetSettingAccountResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
    const { data } = await API.getSettingAccount({
        'Cookie': req.headers.cookie || ''
    });

    if (data.errorCode === API.ERROR.NEED_LOGIN) {
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

interface AccountForm {
    name: string;
    password: string;
    passwordConfirm: string;
}

const AccountSetting: PageComponent<Props> = (props) => {
    const [isChangeUsername, setChangeUsername] = useState(false);
    const [username, setUsername] = useState(props.username);
    const [hasConnected2fa] = useValue(authStore, 'hasConnected2fa');

    const {
        reset,
        register,
        setFocus,
        handleSubmit
    } = useForm<AccountForm>();

    useDidMount(() => {
        reset({
            name: props.name
        });
    });

    const handleAccountSubmit = handleSubmit(async (form) => {
        if (!form.name) {
            setFocus('name');
            snackBar(message('BEFORE_REQ_ERR', '이름은 비워둘 수 없습니다.'));
            return;
        }

        if (form.password) {
            if (form.password.length < 8) {
                setFocus('password');
                snackBar(message('BEFORE_REQ_ERR', '패스워드는 8자 이상이어야 합니다.'));
                return;
            }

            if (!/[0-9]/.test(form.password)) {
                setFocus('password');
                snackBar(message('BEFORE_REQ_ERR', '패스워드는 숫자를 포함해야 합니다.'));
                return;
            }

            if (!/[a-z]/.test(form.password)) {
                setFocus('password');
                snackBar(message('BEFORE_REQ_ERR', '패스워드는 소문자를 포함해야 합니다.'));
                return;
            }

            if (!/[A-Z]/.test(form.password)) {
                setFocus('password');
                snackBar(message('BEFORE_REQ_ERR', '패스워드는 대문자를 포함해야 합니다.'));
                return;
            }

            if (!/[^a-zA-Z0-9]/.test(form.password)) {
                setFocus('password');
                snackBar(message('BEFORE_REQ_ERR', '패스워드는 특수문자를 포함해야 합니다.'));
                return;
            }

            if (form.password !== form.passwordConfirm) {
                setFocus('password');
                snackBar(message('BEFORE_REQ_ERR', '패스워드가 서로 다릅니다.'));
                return;
            }
        }

        const { data } = await API.putSetting('account', {
            name: form.name,
            password: form.password
        });

        if (data.status === 'DONE') {
            snackBar('😀 정보가 업데이트 되었습니다.');

            reset({
                ...form,
                password: '',
                passwordConfirm: ''
            });
        } else {
            snackBar(message('AFTER_REQ_ERR', data.errorMessage));
        }
    });

    const handleChangeUsername = async () => {
        const { data } = await API.patchSign({
            username
        });
        if (data.status === 'ERROR') {
            snackBar(message('AFTER_REQ_ERR', data.errorMessage));
            setUsername(props.username);
            setChangeUsername(false);
            return;
        }
        if (data.status === 'DONE') {
            snackBar('😀 아이디가 변경되었습니다.');
            authStore.set((state) => ({
                ...state,
                username: username
            }));
            setChangeUsername(false);
        }
    };

    const handleDeleteTwoFactorAuth = async () => {
        if (!confirm('😥 정말 2차 인증을 해제할까요?')) {
            return;
        }

        const { data } = await API.deleteSecurity();
        if (data.status === 'ERROR') {
            if (data.errorCode == API.ERROR.ALREADY_DISCONNECTED) {
                snackBar('😥 이미 해제되어 있습니다.');
                return;
            }
            if (data.errorCode == API.ERROR.REJECT) {
                snackBar('😥 인증을 해제할 수 없습니다.');
                return;
            }
        }
        if (data.status === 'DONE') {
            snackBar('😀 2차 인증이 해제되었습니다.');
            authStore.set((prevState) => ({
                ...prevState,
                is2faSync: false
            }));
            return;
        }
        snackBar('😥 해제중 오류가 발생했습니다.');
    };

    return (
        <form onSubmit={handleAccountSubmit}>
            <Card hasBackground isRounded className="mb-4 p-3">
                <Text fontSize={6} fontWeight={600}>
                    가입일
                </Text>
                <Text>{props.createdDate}</Text>
            </Card>
            <Card hasBackground isRounded className="mb-4 p-3">
                <Flex justify="between" className="mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 필명
                    </Text>
                    {isChangeUsername && (
                        <Flex gap={1}>
                            <Button onClick={handleChangeUsername}>
                                업데이트
                            </Button>
                            <Button
                                onClick={() => {
                                    setChangeUsername(false);
                                    setUsername(props.username);
                                }}>
                                취소
                            </Button>
                        </Flex>
                    )}
                    {!isChangeUsername && (
                        <Button onClick={() => setChangeUsername(true)}>
                            변경
                        </Button>
                    )}
                </Flex>
                <Alert type="warning">
                    사용자의 필명은 로그인시 사용되며 주소(URL)에 표기되는 이름입니다.
                    작성한 포스트가 존재하는 경우 6개월에 한번만 변경할 수 있습니다.
                </Alert>
                <div className="mt-2">
                    {isChangeUsername ? (
                        <input
                            type="text"
                            placeholder="사용자 필명"
                            className="form-control"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                    ) : (
                        <Text>{username}</Text>
                    )}
                </div>
            </Card>
            <Card hasBackground isRounded className="mb-4 p-3">
                <Flex justify="between" className="mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 이름
                    </Text>
                    <Button type="submit">
                        업데이트
                    </Button>
                </Flex>
                <div className="mt-2">
                    <input
                        {...register('name')}
                        type="text"
                        placeholder="사용자 실명"
                        className="form-control mb-2"
                        maxLength={30}
                    />
                </div>
            </Card>
            <Card hasBackground isRounded className="mb-4 p-3">
                <Flex justify="between" className="mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        이메일
                    </Text>
                </Flex>
                <Text>{props.email}</Text>
            </Card>
            <Card hasBackground isRounded className="mb-4 p-3">
                <Flex justify="between" className="mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        비밀번호 변경
                    </Text>
                    <Button type="submit">
                        업데이트
                    </Button>
                </Flex>
                <Alert type="warning" className="mb-2">
                    비밀번호는 8자 이상, 소문자, 대문자, 숫자, 특수문자를 포함해야 합니다.
                </Alert>
                <input
                    {...register('password')}
                    type="password"
                    placeholder="새 비밀번호"
                    className="form-control mb-2"
                    maxLength={200}
                />
                <input
                    {...register('passwordConfirm')}
                    type="password"
                    placeholder="비밀번호 확인"
                    className="form-control mb-2"
                    maxLength={200}
                />
            </Card>
            <Flex justify="end" gap={2} className="mb-4">
                {hasConnected2fa ? (
                    <Button onClick={handleDeleteTwoFactorAuth}>
                        2차 인증 중지
                    </Button>
                ) : (
                    <Button onClick={() => modalStore.open('isOpenTwoFactorAuthSyncModal')}>
                        2차 인증 활성화
                    </Button>
                )}
                <Button onClick={() => modalStore.open('isOpenAccountDeleteModal')}>
                    계정 삭제
                </Button>
            </Flex>
        </form>
    );
};

AccountSetting.pageLayout = (page) => (
    <SettingLayout active="account">
        {page}
    </SettingLayout>
);

export default AccountSetting;
