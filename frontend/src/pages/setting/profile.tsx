import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useValue } from 'badland-react';

import {
    Alert,
    Button,
    Card,
    Flex,
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

export const getServerSideProps: GetServerSideProps<Props> = async ({ req }) => {
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
}

const ProfileSetting: PageComponent<Props> = (props) => {
    const router = useRouter();
    const [avatar, setAvatar] = useState(props.avatar);
    const [username] = useValue(authStore, 'username');

    const [social, setSocial] = useState(props.social);

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

    const handleSocialSubmit = async () => {
        console.log(social);
    };

    const handleSocialAdd = async () => {
        setSocial([...social, {
            id: Math.random().toString(36),
            name: 'homepage',
            value: ''
        }]);
    };

    const handleSocialRemove = async (idx: number) => {
        setSocial(social.filter((_, i) => i !== idx));
    };

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
                        프로필 소개 페이지에 표시됩니다.
                    </Alert>
                </div>
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
            </form>
            <Card hasBackground isRounded className="mb-4 p-3">
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        소셜 정보
                    </Text>
                    <Button onClick={handleSocialSubmit}>업데이트</Button>
                </div>
                {social.map((item, idx) => (
                    <Flex key={idx} align="center" gap={3} className="mb-2">
                        <div>
                            <select className="form-select" defaultValue={item.name}>
                                <option value="homepage">Homepage</option>
                                <option value="github">GitHub</option>
                                <option value="twitter">Twitter</option>
                                <option value="facebook">Facebook</option>
                                <option value="instagram">Instagram</option>
                                <option value="linkedin">LinkedIn</option>
                                <option value="youtube">YouTube</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div style={{ flex: 1 }}>
                            <input
                                type="text"
                                placeholder="주소"
                                className="form-control"
                                defaultValue={item.value}
                            />
                        </div>
                        <Button onClick={() => handleSocialRemove(idx)}>
                            삭제
                        </Button>
                    </Flex>
                ))}
                <Button display="block" onClick={handleSocialAdd}>
                    새 링크 추가
                </Button>
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
