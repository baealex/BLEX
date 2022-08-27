import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useForm } from 'react-hook-form';
import { useValue } from 'badland-react';

import {
    Alert,
    Button,
    Card,
    CheckBox,
    Text
} from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';

type Props = API.GetSettingAccountResponseData;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
    const { data } = await API.getSettingAccount({ 'Cookie': req.headers.cookie || '' });

    if (data.errorCode === API.ERROR.NOT_LOGIN) {
        return {
            redirect: {
                destination: '/',
                permanent: false
            }
        };
    }

    return { props: data.body };
};

interface AccountForm {
    realname: string;
    password: string;
    passwordConfirm: string;
    agreeDisplayEmail: boolean;
    agreeSendEmail: boolean;
}

const AccountSetting: PageComponent<Props> = (props) => {
    const [ isChangeUsername, setChangeUsername ] = useState(false);
    const [ username, setUsername ] = useState(props.username);
    const [ is2faSync ] = useValue(authStore, 'is2faSync');

    const {
        reset,
        register,
        setFocus,
        handleSubmit: handleSubmitWrapper
    } = useForm<AccountForm>();

    useEffect(() => reset({ ...props }), []);

    const handleSubmit = handleSubmitWrapper(async (formData) => {
        if (!formData.realname) {
            setFocus('realname');
            snackBar(message('BEFORE_REQ_ERR', '이름은 비워둘 수 없습니다.'));
            return;
        }

        if (formData.password !== formData.passwordConfirm) {
            setFocus('password');
            snackBar(message('BEFORE_REQ_ERR', '패스워드가 서로 다릅니다.'));
            return;
        }

        const { data } = await API.putSetting('account', {
            realname: formData.realname,
            password: formData.password,
            AGREE_DISPLAY_EMAIL: formData.agreeDisplayEmail,
            AGREE_SEND_EMAIL: formData.agreeSendEmail
        });

        if (data.status === 'DONE') {
            snackBar('😀 정보가 업데이트 되었습니다.');

            reset({
                ...formData,
                password: '',
                passwordConfirm: ''
            });
        }
    });

    const onChangeUsername = async () => {
        const { data } = await API.patchSign({ username });
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

    const onDeleteTwoFactorAuth = async () => {
        const { data } = await API.deleteSecurity();
        if (data.status === 'ERROR') {
            if (data.errorCode == API.ERROR.ALREADY_UNSYNC) {
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
        <form onSubmit={handleSubmit}>
            <Card hasBackground isRounded className="mb-4 p-3">
                <Text fontSize={6} fontWeight={600}>
                    가입일
                </Text>
                <Text>{props.createdDate}</Text>
            </Card>
            <Card hasBackground isRounded className="mb-4 p-3">
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 필명
                    </Text>
                    {isChangeUsername ? (
                        <div>
                            <Button gap="little" onClick={() => onChangeUsername()}>
                                업데이트
                            </Button>
                            <Button
                                onClick={() => {
                                    setChangeUsername(false);
                                    setUsername(props.username);
                                }}>
                                취소
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => setChangeUsername(true)}>
                            변경
                        </Button>
                    )}
                </div>
                <Alert type="warning">
                    사용자의 필명은 로그인시 사용되며 주소(URL)에 표기되는 이름입니다.
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
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        이메일
                    </Text>
                </div>
                <Text>{props.email}</Text>
            </Card>
            <Card hasBackground isRounded className="mb-4 p-3">
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 실명
                    </Text>
                    <Button type="submit">
                        업데이트
                    </Button>
                </div>
                <Alert type="warning">
                    반드시 실명일 필요는 없으나 실명 사용을 권장합니다.
                </Alert>
                <div className="mt-2">
                    <input
                        {...register('realname')}
                        type="text"
                        placeholder="사용자 실명"
                        className="form-control mb-2"
                        maxLength={30}
                    />
                </div>
            </Card>
            <Card hasBackground isRounded className="mb-4 p-3">
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        비밀번호 변경
                    </Text>
                    <Button type="submit">
                        업데이트
                    </Button>
                </div>
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
            <Card hasBackground isRounded className="mb-4 p-3">
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        개인정보 보호
                    </Text>
                    <Button type="submit">
                        업데이트
                    </Button>
                </div>
                <CheckBox
                    {...register('agreeDisplayEmail')}
                    label="다른 사용자에게 이메일을 노출합니다."
                />
                <CheckBox
                    {...register('agreeSendEmail')}
                    label="서비스의 이메일 전송을 허용합니다."
                />
            </Card>
            {is2faSync ? (
                <Button gap="little" onClick={() => confirm('😥 정말 2차 인증을 해제할까요?') && onDeleteTwoFactorAuth()}>
                    2차 인증 중지
                </Button>
            ) : (
                <Button gap="little" onClick={() => modalStore.open('is2FASyncModalOpen')}>
                    2차 인증 등록
                </Button>
            )}
            <Button onClick={() => modalStore.open('isSignoutModalOpen')}>
                사용자 탈퇴
            </Button>
        </form>
    );
};

AccountSetting.pageLayout = (page) => (
    <SettingLayout active="account">
        {page}
    </SettingLayout>
);

export default AccountSetting;
