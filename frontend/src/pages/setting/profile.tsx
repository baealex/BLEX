import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useValue } from 'badland-react';

import { type DragEndEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

import {
    Alert,
    Button,
    Card,
    Flex,
    ImageInput,
    SortableItem,
    Text,
    VerticalSortable
} from '~/components/design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '~/components/system-design/setting';

import * as API from '~/modules/api';
import { getIconClassName } from '~/modules/utility/icon-class';
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
    homepage: string;
}

const ProfileSetting: PageComponent<Props> = (props) => {
    const router = useRouter();
    const [avatar, setAvatar] = useState(props.avatar);
    const [username] = useValue(authStore, 'username');

    const [socials, setSocials] = useState(props.social.map((social) => ({
        ...social,
        prepare: false
    })));

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
        if (socials.some((social) => !social.name)) {
            snackBar(message('BEFORE_REQ_ERR', '소셜 아이콘을 모두 선택해주세요.'));
            return;
        }

        if (socials.some((social) => !social.value)) {
            snackBar(message('BEFORE_REQ_ERR', '소셜 주소를 모두 입력해주세요.'));
            return;
        }

        if (socials.some((social) => !social.value.startsWith('https://'))) {
            snackBar(message('BEFORE_REQ_ERR', '소셜 주소는 https:// 로 시작해야 합니다.'));
            return;
        }

        if (socials.some((social) => social.value.includes(',') || social.value.includes('&'))) {
            snackBar(message('BEFORE_REQ_ERR', '소셜 주소에는 , 와 & 를 포함할 수 없습니다.'));
            return;
        }

        const updateItems = socials.filter((social) => !social.prepare);
        const createItems = socials.filter((social) => social.prepare);

        const { data } = await API.putSetting('social', {
            update: updateItems.map((item) => `${item.id},${item.name},${item.value},${item.order}`).join('&'),
            create: createItems.map((item) => `${item.name},${item.value},${item.order}`).join('&')
        });

        if (data.status === 'DONE') {
            snackBar(message('AFTER_REQ_DONE', '소셜 정보가 업데이트 되었습니다.'));
            setSocials((data.body as typeof socials).map((social) => ({
                ...social,
                prepare: false
            })));
        }
    };

    const handleSocialAdd = async () => {
        setSocials([...socials, {
            id: Math.random(),
            name: '',
            value: '',
            order: socials.length + 1,
            prepare: true
        }]);
    };

    const handleSocialRemove = async (id: number) => {
        setSocials((prevState) => {
            const item = prevState.find((item) => item.id === id);

            if (item?.prepare === false) {
                if (!confirm(message('CONFIRM', '정말 이 링크를 삭제할까요?'))) return prevState;

                API.putSetting('social', { delete: `${item.id}` }).then(({ data }) => {
                    if (data.status === 'DONE') {
                        snackBar(message('AFTER_REQ_DONE', '소셜 정보가 업데이트 되었습니다.'));
                    }
                });
            }

            return prevState.filter((item) => item.id !== id);
        });
    };

    const handleSocialDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over) {
            if (active.id === over.id) return;

            setSocials((prevSocials) => {
                const oldIndex = prevSocials.findIndex((item) => item.id === Number(active.id));
                const newIndex = prevSocials.findIndex((item) => item.id === Number(over.id));
                const nextSocials = arrayMove(prevSocials, oldIndex, newIndex);
                nextSocials.forEach((item, idx) => {
                    item.order = idx;
                });
                return nextSocials;
            });
        }
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
                <Flex justify="between" className="mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        사용자 상세 소개
                    </Text>
                    <Flex gap={1}>
                        <Button onClick={() => router.push(`/@${username}?preview=about`)}>
                            페이지 확인
                        </Button>
                        <Button onClick={() => router.push(`/@${username}/about/edit`)}>
                            소개 작성
                        </Button>
                    </Flex>
                </Flex>
                <div className="mb-2">
                    <Alert type="warning">
                        프로필 메인 페이지 상단에 표시됩니다.
                    </Alert>
                </div>
            </Card>
            <form onSubmit={handleSubmit}>
                <Card hasBackground isRounded className="mb-4 p-3">
                    <Flex justify="between" className="mb-2">
                        <Text fontSize={6} fontWeight={600}>
                            사용자 간단 소개
                        </Text>
                        <Button type="submit">
                            업데이트
                        </Button>
                    </Flex>
                    <input
                        {...register('homepage')}
                        type="url"
                        placeholder="개인 홈페이지"
                        className="form-control mb-3"
                    />
                    <textarea
                        {...register('bio')}
                        cols={40}
                        rows={4}
                        placeholder="본인을 한줄로 표현한다면?"
                        className="form-control mb-3"
                    />
                </Card>
            </form>
            <Card hasBackground isRounded className="mb-4 p-3">
                <Flex justify="between" className="mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        소셜 정보
                    </Text>
                    <Button onClick={handleSocialSubmit}>업데이트</Button>
                </Flex>
                {socials.some((social) => social.prepare) && (
                    <Alert type="warning" className="mb-2">
                        소셜 정보를 갱신 하시려면 반드시 업데이트 버튼을 눌러주세요.
                    </Alert>
                )}
                <VerticalSortable
                    items={socials.map((social) => social.id.toString())}
                    onDragEnd={handleSocialDragEnd}>
                    {socials.map((social, index) => (
                        <SortableItem
                            key={social.id}
                            id={social.id.toString()}
                            render={({ listeners }) => (
                                <Flex align="center" gap={2} className="mb-2">
                                    <Flex justify="between" align="center">
                                        <div
                                            {...listeners}
                                            className="px-2"
                                            style={{
                                                cursor: 'grab',
                                                touchAction: 'none'
                                            }}>
                                            <i className="fas fa-bars"></i>
                                        </div>
                                    </Flex>
                                    <Flex justify="between" align="center">
                                        <div
                                            style={{ width: '16px' }}>
                                            <i className={getIconClassName(social.name)} />
                                        </div>
                                    </Flex>
                                    <div>
                                        <select
                                            className="form-select"
                                            defaultValue={social.name}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setSocials(prev => {
                                                    const newSocials = [...prev];
                                                    newSocials[index].name = value;
                                                    return newSocials;
                                                });
                                            }}>
                                            <option disabled value="">아이콘</option>
                                            <option value="github">깃허브</option>
                                            <option value="twitter">트위터</option>
                                            <option value="facebook">페이스북</option>
                                            <option value="telegram">텔레그램</option>
                                            <option value="instagram">인스타그램</option>
                                            <option value="linkedin">링크드인</option>
                                            <option value="youtube">유튜브</option>
                                            <option value="other">기타</option>
                                        </select>
                                    </div>
                                    <div
                                        style={{ flex: 1 }}>
                                        <input
                                            type="url"
                                            placeholder="주소"
                                            className="form-control"
                                            defaultValue={social.value}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setSocials(prev => {
                                                    const newSocials = [...prev];
                                                    newSocials[index].value = value;
                                                    return newSocials;
                                                });
                                            }}
                                        />
                                    </div>
                                    <Button color="default" onClick={() => handleSocialRemove(social.id)}>
                                        <i className="fas fa-times" />
                                    </Button>
                                </Flex>
                            )}
                        />
                    ))}
                </VerticalSortable>
                <Button display="block" onClick={handleSocialAdd}>
                    링크 추가
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
