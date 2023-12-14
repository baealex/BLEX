import { useEffect, useState } from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

import { Button, Card, Flex, Label, Progress, Text, Toggle } from '~/components/design-system';
import {
    EditorLayout,
    TempArticleModal
} from '@system-design/article-editor-page';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { useFetch } from '~/hooks/use-fetch';

import { configStore } from '~/stores/config';
import { modalStore } from '~/stores/modal';
import { useValue } from 'badland-react';

interface Props {
    username: string;
    token?: string;
    title: string;
    content: string;
    tags: string;
}

export const getServerSideProps: GetServerSideProps<Props> = async ({ req, query }) => {
    const { cookies } = req;
    configStore.serverSideInject(cookies);

    const { cookie } = req.headers;
    const { data } = await API.getLogin({ 'Cookie': cookie || '' });

    if (data.status !== 'DONE') {
        return { notFound: true };
    }

    const { token = '' } = query;

    if (token) {
        const { data: tempPost } = await API.getAnTempPosts(
            String(token),
            { 'Cookie': cookie || '' }
        );
        if (tempPost.status === 'DONE') {
            return {
                props: {
                    username: data.body.username,
                    token: String(token),
                    title: tempPost.body.title,
                    content: tempPost.body.textMd,
                    tags: tempPost.body.tags
                }
            };
        }
    }

    return {
        props: {
            username: data.body.username,
            title: '',
            content: '',
            tags: ''
        }
    };
};

export default function Write(props: Props) {
    const router = useRouter();

    const [image, setImage] = useState<File | undefined>(undefined);
    const [title, setTitle] = useState(props.title);
    const [content, setContent] = useState(props.content);
    const [tags, setTags] = useState(props.tags);
    const [token, setToken] = useState(props.token || '');

    const [url, setUrl] = useState('');
    const [description, setDescription] = useState('');
    const [series, setSeries] = useState('');
    const [reservedDate, setReservedDate] = useState<Date | null>(null);
    const [isHide, setIsHide] = useState(false);
    const [isAd, setIsAd] = useState(false);

    const [isAutoSave, setIsAutoSave] = useValue(configStore, 'isAutoSave');
    const [isRunningAutoSave, setIsRunningAutoSave] = useState(false);
    const [selectedTempPost, setSelectedTempPost] = useState('');
    const [lastSavedTime, setLastSavedTime] = useState('');
    const [isOpenTempArticleModal, setIsOpenTempArticleModal] = useState(false);

    const { data: tempPosts, mutate: setTempPosts } = useFetch('getTempPosts', async () => {
        const { data } = await API.getTempPosts();
        return data.body.temps;
    });

    const resetState = () => {
        setImage(undefined);
        setTitle(props.title);
        setContent(props.content);
        setTags(props.tags);
        setToken(props.token || '');

        setUrl('');
        setDescription('');
        setSeries('');
        setReservedDate(null);
        setIsHide(false);
        setIsAd(false);

        setIsRunningAutoSave(false);
        setSelectedTempPost('');
        setLastSavedTime('');
        setIsOpenTempArticleModal(false);
    };

    const handleSubmit = async (onFail?: () => void) => {
        if (!title) {
            snackBar(message('BEFORE_REQ_ERR', '제목을 입력해주세요'));
            onFail?.();
            return;
        }

        try {
            const { data } = await API.createPost({
                title,
                text_md: content || '내용 없음',
                tag: tags || '미분류',
                token,
                url,
                description,
                series,
                reserved_date: reservedDate?.toISOString() || '',
                image,
                is_hide: isHide.toString(),
                is_advertise: isAd.toString()
            });
            router.push(`/@${props.username}/${data.body.url}`);
        } catch (err) {
            snackBar(message('AFTER_REQ_ERR', '발행중 오류가 발생했습니다'));
            onFail?.();
            return;
        }
    };

    const handleTempSave = async () => {
        const defaultTitle = title || new Date().toLocaleString();

        if (!token) {
            const { data } = await API.postTempPosts({
                title: defaultTitle,
                text_md: content,
                tag: tags
            });
            setToken(data.body.token);
            setTempPosts((prev) => [...prev, {
                token: data.body.token,
                title: defaultTitle,
                createdDate: '0분 전'
            }]);
        } else {
            await API.putTempPosts(token, {
                title: defaultTitle,
                text_md: content,
                tag: tags
            });
            setTempPosts((prev) => prev.map((item) => item.token === token
                ? {
                    ...item,
                    title: defaultTitle,
                    createdDate: '0분 전'
                } : item
            ));
        }

        setTitle(defaultTitle);
        setSelectedTempPost(title);
        setIsRunningAutoSave(false);
        setLastSavedTime(new Date().toLocaleString());
    };

    const handleDeleteTempPost = async (token: string) => {
        if (confirm('😅 정말 임시글을 삭제할까요?')) {
            const { data } = await API.deleteTempPosts(token);
            if (data.status === 'DONE') {
                setTempPosts((prev) => prev.filter((item) => item.token !== token));
                snackBar('😀 임시글이 삭제되었습니다.');
            }
        }
    };

    const handleClickTempPost = async (token: string) => {
        if (!token) {
            router.push('/write');
            return;
        }
        router.push(`/write?token=${token}`);
    };

    useEffect(() => {
        setSelectedTempPost(props.title);
        if (props.token && props.token !== token) {
            resetState();
        }
    }, [props.title, props.token, token]);

    useEffect(() => {
        setIsRunningAutoSave(false);
        if (isAutoSave && (title !== props.title || content !== props.content || tags !== props.tags)) {
            const timer = setTimeout(() => {
                setIsRunningAutoSave(true);
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [isAutoSave, title, content, tags, props.title, props.content, props.tags]);

    return (
        <EditorLayout
            image={{
                onChange: setImage
            }}
            title={{
                value: title,
                onChange: setTitle
            }}
            content={{
                value: content,
                onChange: setContent
            }}
            tags={{
                value: tags,
                onChange: setTags
            }}
            url={{
                value: url,
                onChange: setUrl
            }}
            description={{
                value: description,
                onChange: setDescription
            }}
            series={{
                value: series,
                onChange: setSeries
            }}
            reservedDate={{
                value: reservedDate,
                onChange: setReservedDate
            }}
            isHide={{
                value: isHide,
                onChange: setIsHide
            }}
            isAd={{
                value: isAd,
                onChange: setIsAd
            }}
            publish={{
                title: '포스트 발행',
                buttonText: '이대로 발행하겠습니다'
            }}
            onSubmit={handleSubmit}
            extended={{
                footer: (
                    <>
                        <Label>임시 저장</Label>
                        <Card>
                            <div className="p-2">
                                {selectedTempPost && (
                                    <div className="p-1 d-flex align-items-center" style={{ gap: '4px' }}>
                                        <Text fontSize={3} className="shallow-dark">
                                            선택된 임시글
                                        </Text>
                                        <Text fontSize={3}>
                                            {selectedTempPost}
                                        </Text>
                                    </div>
                                )}
                                {lastSavedTime && (
                                    <div className="p-1 d-flex align-items-center" style={{ gap: '4px' }}>
                                        <Text fontSize={3} className="shallow-dark">
                                            최종 저장 시간
                                        </Text>
                                        <Text fontSize={3} >
                                            {lastSavedTime}
                                        </Text>
                                    </div>
                                )}
                                <div className="p-1 d-flex justify-content-between">
                                    <Toggle
                                        label="자동 저장"
                                        defaultChecked={isAutoSave as boolean}
                                        onClick={(checked) => setIsAutoSave(checked)}
                                    />
                                    <div className="d-flex">
                                        <Button
                                            gap="little"
                                            color="transparent"
                                            onClick={() => setIsOpenTempArticleModal(true)}>
                                            목록
                                        </Button>
                                        <Button
                                            color="transparent"
                                            onClick={handleTempSave}>
                                            저장
                                        </Button>
                                    </div>
                                </div>
                            </div>
                            {isAutoSave && (
                                <Progress
                                    type="timer"
                                    time={8}
                                    isReady={isRunningAutoSave}
                                    onEnd={handleTempSave}
                                />
                            )}
                        </Card>
                        <Flex justify="end" gap={2}>
                            <Button
                                className="my-3"
                                color="secondary"
                                onClick={() => handleSubmit()}>
                                간편 발행
                            </Button>
                            <Button
                                className="my-3"
                                color="secondary"
                                onClick={() => {
                                    modalStore.open('isOpenArticlePublishModal');
                                }}>
                                포스트 발행
                            </Button>
                        </Flex>
                    </>
                )
            }}
            addon={{
                toolbar: [
                    {
                        name: 'saved',
                        action: () => setIsOpenTempArticleModal(true),
                        className: 'far fa-save',
                        title: '임시 저장'
                    }
                ],
                modal: (
                    <TempArticleModal
                        token={token}
                        isOpen={isOpenTempArticleModal}
                        onClose={() => setIsOpenTempArticleModal(false)}
                        tempPosts={tempPosts || []}
                        onClick={handleClickTempPost}
                        onDelete={handleDeleteTempPost}
                    />
                )
            }}
        />
    );
}
