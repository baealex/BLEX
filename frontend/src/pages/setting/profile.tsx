import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useValue } from 'badland-react';

import {
    Alert,
    Button,
    Card,
    ImageInput,
    Text
} from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { loadingStore } from '~/stores/loading';

import { useForm } from '~/hooks/use-form';

type Props = API.GetSettingProfileResponseData;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
    const { data } = await API.getSettingProfile({ 'Cookie': req.headers.cookie || '' });

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

interface ProfileForm {
    bio: string;
    homepage: string;
    github: string;
    twitter: string;
    instagram: string;
    facebook: string;
    youtube: string;
}

const ProfileSetting: PageComponent<Props> = (props) => {
    const router = useRouter();
    const [ avatar, setAvatar ] = useState(props.avatar);
    const [ username ] = useValue(authStore, 'username');

    const {
        reset,
        register,
        handleSubmit: handleSubmitWrapper
    } = useForm<ProfileForm>();

    useEffect(() => reset({ ...props }), []);

    const handleSubmit = handleSubmitWrapper(async (formData: ProfileForm) => {
        const { data } = await API.putSetting('profile', formData);

        if (data.status === 'DONE') {
            snackBar(message('AFTER_REQ_DONE', '프로필이 업데이트 되었습니다.'));
        }
    });

    return (
        <>
            <Card hasBackground isRounded className="mb-4 p-3">
                <div className="mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 이미지
                    </Text>
                </div>
                <ImageInput
                    url={avatar}
                    label="이미지 변경"
                    onChange={async (file) => {
                        loadingStore.set({ isLoading: true });
                        const formData = new FormData();
                        formData.append('avatar', file);
                        const { data } = await API.postSettingAvatar(formData);
                        setAvatar(data.body.url);
                        loadingStore.set({ isLoading: false });
                    }}
                />
            </Card>
            <form onSubmit={handleSubmit}>
                <Card hasBackground isRounded className="mb-4 p-3">
                    <div className="d-flex justify-content-between mb-2">
                        <Text fontSize={6} fontWeight={600}>
                            사용자 간략 소개
                        </Text>
                        <Button type="submit">
                            업데이트
                        </Button>
                    </div>
                    <div className="mb-2">
                        <Alert type="warning">
                            포스트 상단에서 작성자를 소개하는 문장입니다.
                            자신을 한문장으로 표현해 본다면?
                        </Alert>
                    </div>
                    <textarea
                        {...register('bio')}
                        cols={40}
                        rows={4}
                        placeholder="자신을 간단히 설명하세요."
                        className="form-control mb-3"
                    />
                </Card>
                <Card hasBackground isRounded className="mb-4 p-3">
                    <div className="d-flex justify-content-between mb-2">
                        <Text fontSize={6} fontWeight={600}>
                            소셜 정보
                        </Text>
                        <Button type="submit">
                            업데이트
                        </Button>
                    </div>
                    <label>개인 홈페이지 주소 : </label>
                    <div className="input-group mb-3">
                        <div className="input-group-prepend">
                            <span className="input-group-text">https://</span>
                        </div>
                        <input
                            {...register('homepage')}
                            type="text"
                            className="form-control"
                            maxLength={100}
                        />
                    </div>
                    <label>깃허브 주소 : </label>
                    <div className="input-group mb-3">
                        <div className="input-group-prepend">
                            <span className="input-group-text">https://github.com/</span>
                        </div>
                        <input
                            {...register('github')}
                            type="text"
                            className="form-control"
                            maxLength={100}
                        />
                    </div>
                    <label>트위터 주소 : </label>
                    <div className="input-group mb-3">
                        <div className="input-group-prepend">
                            <span className="input-group-text">https://twitter.com/</span>
                        </div>
                        <input
                            {...register('twitter')}
                            type="text"
                            className="form-control"
                            maxLength={100}
                        />
                    </div>
                    <label>페이스북 주소 : </label>
                    <div className="input-group mb-3">
                        <div className="input-group-prepend">
                            <span className="input-group-text">https://facebook.com/</span>
                        </div>
                        <input
                            {...register('facebook')}
                            type="text"
                            className="form-control"
                            maxLength={100}
                        />
                    </div>
                    <label>인스타그램 주소 : </label>
                    <div className="input-group mb-3">
                        <div className="input-group-prepend">
                            <span className="input-group-text">https://instagram.com/</span>
                        </div>
                        <input
                            {...register('instagram')}
                            type="text"
                            className="form-control"
                            maxLength={100}
                        />
                    </div>
                    <label>유튜브 채널 주소 : </label>
                    <div className="input-group mb-3">
                        <div className="input-group-prepend">
                            <span className="input-group-text">https://youtube.com/channel/</span>
                        </div>
                        <input
                            {...register('youtube')}
                            type="text"
                            className="form-control"
                            maxLength={100}
                        />
                    </div>
                </Card>
            </form>
            <Card hasBackground isRounded className="mb-4 p-3">
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 상세 소개
                    </Text>
                    <div>
                        <Button gap="little" onClick={() => router.push(`/@${username}/about`)}>
                            페이지 확인
                        </Button>
                        <Button onClick={() => router.push(`/@${username}/about/edit`)}>
                            소개 작성
                        </Button>
                    </div>
                </div>
                <div className="mb-2">
                    <Alert type="warning">
                        프로필의 소개 페이지에 표시되는 소개입니다.
                    </Alert>
                </div>
            </Card>
        </>
    );
};

ProfileSetting.pageLayout = (page) => (
    <SettingLayout active="profile">
        {page}
    </SettingLayout>
);

export default ProfileSetting;
