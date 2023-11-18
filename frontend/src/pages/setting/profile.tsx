import React, { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useValue } from 'badland-react';

import { arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DragEndEvent } from '@dnd-kit/core';

import {
    Alert,
    Button,
    Card,
    Flex,
    ImageInput,
    Text,
    VerticalSortable
} from '@design-system';
import type { PageComponent } from '~/components';
import { SettingLayout } from '@system-design/setting';

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

function SocialItem(props: {
    id: number;
    name: string;
    value: string;
    onChangeName: (name: string) => void;
    onChangeValue: (value: string) => void;
    onClickDelete: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
        id: props.id.toString()
    });

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            style={{
                transform: CSS.Translate.toString(transform),
                transition
            }}>
            <Flex align="center" gap={3} className="mb-2">
                <div className="d-flex justify-content-between align-items-center">
                    <div
                        {...listeners}
                        className="px-2"
                        style={{
                            cursor: 'grab',
                            touchAction: 'none'
                        }}>
                        <i className="fas fa-bars"></i>
                    </div>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                    <div style={{ width: '16px' }}>
                        <i className={getIconClassName(props.name)} />
                    </div>
                </div>
                <div>
                    <select
                        className="form-select"
                        defaultValue={props.name}
                        onChange={(e) => {
                            const value = e.target.value;
                            props.onChangeName(value);
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
                <div style={{ flex: 1 }}>
                    <input
                        type="url"
                        placeholder="주소"
                        className="form-control"
                        defaultValue={props.value}
                        onChange={(e) => {
                            const value = e.target.value;
                            props.onChangeValue(value);
                        }}
                    />
                </div>
                <Button onClick={() => props.onClickDelete()}>
                    삭제
                </Button>
            </Flex>
        </div>
    );
}

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

                API.putSetting('social', {
                    delete: `${item.id}`
                }).then(({ data }) => {
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
                            사용자 간단 소개
                        </Text>
                        <Button type="submit">
                            업데이트
                        </Button>
                    </div>
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
                <div className="d-flex justify-content-between mb-2">
                    <Text fontSize={6} fontWeight={600}>
                        소셜 정보
                    </Text>
                    <Button onClick={handleSocialSubmit}>업데이트</Button>
                </div>
                <VerticalSortable
                    items={socials.map((social) => social.id.toString())}
                    onDragEnd={handleSocialDragEnd}>
                    {socials.map((social) => (
                        <SocialItem
                            key={social.id}
                            id={social.id}
                            name={social.name}
                            value={social.value}
                            onClickDelete={() => handleSocialRemove(social.id)}
                            onChangeName={(name) => {
                                setSocials(socials.map((item) => {
                                    if (item.id === social.id) {
                                        return {
                                            ...item,
                                            name
                                        };
                                    }
                                    return item;
                                }));
                            }}
                            onChangeValue={(value) => {
                                setSocials(socials.map((item) => {
                                    if (item.id === social.id) {
                                        return {
                                            ...item,
                                            value
                                        };
                                    }
                                    return item;
                                }));
                            }}
                        />
                    ))}
                </VerticalSortable>
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
