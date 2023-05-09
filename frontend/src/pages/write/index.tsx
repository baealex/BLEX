import type { GetServerSideProps } from 'next';
import React from 'react';
import Router from 'next/router';

import { Button, Card, Label, Progress, Text, Toggle } from '~/components/design-system';
import {
    EditorLayout,
    TempArticleModal
} from '@system-design/article-editor-page';

import * as API from '~/modules/api';
import {
    DebounceEventRunner,
    debounceEvent
} from '~/modules/optimize/event';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { configStore } from '~/stores/config';
import { modalStore } from '~/stores/modal';

interface Props {
    username: string;
}

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
    const { cookies } = req;
    configStore.serverSideInject(cookies);

    const { cookie } = req.headers;
    const { data } = await API.getLogin({ 'Cookie': cookie || '' });

    if (data.status !== 'DONE') {
        return { notFound: true };
    }

    return { props: { username: data.body.username } };
};

interface State {
    username: string;
    title: string;
    tags: string;
    url: string;
    content: string;
    description: string;
    token: string;
    series: string;
    reservedDate: Date | null;
    image: File | undefined;
    isAutoSave: boolean;
    isRunningAutoSave: boolean;
    selectedTempPost: string;
    lastSavedTime: string;
    isHide: boolean;
    isAd: boolean;
    isOpenArticleModal: boolean;
    tempPosts: API.GetTempPostsResponseData['temps'];
    tempPostsCache: {
        [token: string]: {
            title: string;
            content: string;
            tags: string;
        };
    };
}

class Write extends React.Component<Props, State> {
    private saver: DebounceEventRunner<unknown>;
    private authUpdateKey: string;
    private configUpdateKey: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            username: props.username,
            title: '',
            url: '',
            content: '',
            description: '',
            tags: '',
            token: '',
            series: '',
            reservedDate: null,
            isHide: false,
            isAd: false,
            image: undefined,
            isAutoSave: configStore.state.isAutoSave,
            isRunningAutoSave: false,
            selectedTempPost: '',
            lastSavedTime: '',
            isOpenArticleModal: false,
            tempPosts: [],
            tempPostsCache: {}
        };
        this.authUpdateKey = authStore.subscribe((state) => {
            this.setState({ username: state.username });
        });
        this.configUpdateKey = configStore.subscribe((state) => {
            this.setState({ isAutoSave: state.isAutoSave });
        });

        this.saver = debounceEvent(() => {
            this.setState({ isRunningAutoSave: true });
        }, 0);
    }

    /* Component Method */

    componentDidMount() {
        API.getTempPosts().then(({ data }) => {
            if (data.body.temps.length > 0) {
                this.setState({ tempPosts: data.body.temps });
                snackBar('😀 작성하던 포스트가 있으시네요!', {
                    onClick: () => {
                        this.setState({ isOpenArticleModal: true });
                    }
                });
            }
        });
    }

    componentWillUnmount() {
        this.saver.clear();
        configStore.unsubscribe(this.configUpdateKey);
        authStore.unsubscribe(this.authUpdateKey);
    }

    /* Inner Method */

    async fetchTempPosts(token = '') {
        if (token) {
            const { tempPostsCache } = this.state;

            // 캐시가 존재하는 경우
            if (tempPostsCache[token]) {
                const {
                    title, content, tags
                } = tempPostsCache[token];
                this.setState({
                    selectedTempPost: title,
                    title,
                    content,
                    tags,
                    token
                });
                return;
            }

            // 캐시 없을 때
            const { data } = await API.getAnTempPosts(token);
            this.setState({
                selectedTempPost: data.body.title,
                title: data.body.title,
                content: data.body.textMd,
                tags: data.body.tags,
                token: data.body.token,
                tempPostsCache: {
                    ...tempPostsCache,
                    [data.body.token]: {
                        title: data.body.title,
                        content: data.body.textMd,
                        tags: data.body.tags
                    }
                }
            });
            return;
        }

        // 새 글 작성
        this.setState({
            selectedTempPost: '',
            title: '',
            content: '',
            tags: '',
            token: ''
        });
    }

    async onSubmit(onFail: () => void) {
        if (!this.state.title) {
            snackBar('😅 제목이 비어있습니다.');
            onFail();
            return;
        }
        if (!this.state.tags) {
            snackBar('😅 태그를 작성해주세요.');
            onFail();
            return;
        }
        try {
            if (this.saver) {
                this.saver.clear();
            }

            const { data } = await API.postPosts({
                token: this.state.token,
                title: this.state.title,
                text_md: this.state.content,
                image: this.state.image,
                tag: this.state.tags,
                url: this.state.url,
                description: this.state.description,
                series: this.state.series,
                reserved_date: this.state.reservedDate
                    ? this.state.reservedDate.toISOString()
                    : undefined,
                is_hide: JSON.stringify(this.state.isHide),
                is_advertise: JSON.stringify(this.state.isAd)
            });
            Router.push('/[author]/[posturl]', `/@${this.state.username}/${data.body.url}`);
        } catch (e) {
            snackBar('😥 글 작성중 오류가 발생했습니다.');
            onFail();
        }
    }

    async onDeleteTempPost(token: string) {
        if (confirm('😅 정말 임시글을 삭제할까요?')) {
            const { data } = await API.deleteTempPosts(token);
            if (data.status === 'DONE') {
                this.setState({
                    token: '',
                    tempPosts: this.state.tempPosts.filter(post =>
                        post.token !== token
                    )
                });
                snackBar('😀 임시글이 삭제되었습니다.');
            }
        }
    }

    async onTempSave(token: string, title: string, content: string, tags: string) {
        if (!title) {
            const date = new Date();
            title = date.toLocaleString();
            if (this.state.token == token) {
                this.setState({ title });
            }
        }

        if (token) {
            const { data } = await API.putTempPosts(token, title, content, tags);
            if (data.status === 'DONE') {
                this.setState({
                    tempPosts: this.state.tempPosts.map(post => (
                        post.token == this.state.token ? ({
                            ...post,
                            title: this.state.title
                        }) : post
                    )),
                    tempPostsCache: {
                        ...this.state.tempPostsCache,
                        [token]: {
                            title: this.state.title,
                            content: this.state.content,
                            tags: this.state.tags
                        }
                    },
                    isRunningAutoSave: false,
                    selectedTempPost: title,
                    lastSavedTime: new Date().toLocaleString()
                });
                snackBar('😀 임시 저장이 완료되었습니다.');
            }
        } else {
            const { data } = await API.postTempPosts(title, content, tags);
            if (data.status === 'ERROR') {
                if (data.errorCode === API.ERROR.SIZE_OVERFLOW) {
                    snackBar('😥 임시 저장글 갯수가 초과했습니다');
                    return;
                }
            }
            this.setState({
                token: data.body.token,
                tempPosts: this.state.tempPosts.concat({
                    token: data.body.token,
                    title: title,
                    createdDate: '0분 전'
                }),
                isRunningAutoSave: false,
                selectedTempPost: title,
                lastSavedTime: new Date().toLocaleString()
            });
            snackBar('😀 임시 저장이 완료되었습니다.');
        }
    }

    onCheckAutoSave(checked: boolean) {
        !checked && this.saver.clear();
        configStore.set((state) => ({
            ...state,
            isAutoSave: checked
        }));
    }

    render() {
        const { tempPosts } = this.state;

        return (
            <EditorLayout
                title={{
                    value: this.state.title,
                    onChange: (value: string) => {
                        this.setState({
                            title: value,
                            isRunningAutoSave: false
                        });
                        if (this.state.isAutoSave) {
                            this.saver();
                        }
                    }
                }}
                content={{
                    value: this.state.content,
                    onChange: (value: string) => {
                        this.setState({
                            content: value,
                            isRunningAutoSave: false
                        });
                        if (this.state.isAutoSave) {
                            this.saver();
                        }
                    }
                }}
                tags={{
                    value: this.state.tags,
                    onChange: (value) => {
                        this.setState({
                            tags: value,
                            isRunningAutoSave: false
                        });
                        if (this.state.isAutoSave) {
                            this.saver();
                        }
                    }
                }}
                url={{
                    value: this.state.url,
                    onChange: (value) => this.setState({ url: value })
                }}
                description={{
                    value: this.state.description,
                    onChange: (value) => this.setState({ description: value })
                }}
                series={{
                    value: this.state.series,
                    onChange: (value) => this.setState({ series: value })
                }}
                reservedDate={{
                    value: this.state.reservedDate,
                    onChange: (value) => this.setState({ reservedDate: value })
                }}
                isHide={{
                    value: this.state.isHide,
                    onChange: (value) => this.setState({ isHide: value })
                }}
                isAd={{
                    value: this.state.isAd,
                    onChange: (value) => this.setState({ isAd: value })
                }}
                image={{ onChange: (image) => this.setState({ image: image }) }}
                publish={{
                    title: '포스트 발행',
                    buttonText: '이대로 발행하겠습니다'
                }}
                onSubmit={this.onSubmit.bind(this)}
                extended={{
                    footer: (
                        <>
                            <Label>임시 저장</Label>
                            <Card>
                                <div className="p-2">
                                    {this.state.selectedTempPost && (
                                        <div className="p-1 d-flex align-items-center" style={{ gap: '4px' }}>
                                            <Text fontSize={3} className="shallow-dark">
                                                선택된 임시글
                                            </Text>
                                            <Text fontSize={3}>
                                                {this.state.selectedTempPost}
                                            </Text>
                                        </div>
                                    )}
                                    {this.state.lastSavedTime && (
                                        <div className="p-1 d-flex align-items-center" style={{ gap: '4px' }}>
                                            <Text fontSize={3} className="shallow-dark">
                                                최종 저장 시간
                                            </Text>
                                            <Text fontSize={3} >
                                                {this.state.lastSavedTime}
                                            </Text>
                                        </div>
                                    )}
                                    <div className="p-1 d-flex justify-content-between">
                                        <Toggle
                                            label="자동 저장"
                                            defaultChecked={this.state.isAutoSave}
                                            onClick={(checked) => this.onCheckAutoSave(checked)}
                                        />
                                        <div className="d-flex">
                                            <Button
                                                gap="little"
                                                color="transparent"
                                                onClick={() => {
                                                    this.setState({ isOpenArticleModal: true });
                                                }}>
                                                목록
                                            </Button>
                                            <Button
                                                color="transparent"
                                                onClick={() => {
                                                    const {
                                                        token, title, content, tags
                                                    } = this.state;
                                                    this.onTempSave(token, title, content, tags);
                                                }}>
                                                저장
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                                {this.state.isAutoSave && (
                                    <Progress
                                        type="timer"
                                        time={8}
                                        isReady={this.state.isRunningAutoSave}
                                        onEnd={() => {
                                            const {
                                                token, title, content, tags
                                            } = this.state;
                                            this.onTempSave(token, title, content, tags);
                                        }}
                                    />
                                )}
                            </Card>
                            <div className="d-flex justify-content-end">
                                <Button
                                    className="mt-3"
                                    color="secondary"
                                    onClick={() => {
                                        modalStore.open('isOpenArticlePublishModal');
                                    }}>
                                    글 발행하기
                                </Button>
                            </div>
                        </>
                    )
                }}
                addon={{
                    toolbar: [
                        {
                            name: 'saved',
                            action: () => this.setState({ isOpenArticleModal: true }),
                            className: 'far fa-save',
                            title: '임시 저장'
                        }
                    ],
                    modal: (
                        <TempArticleModal
                            token={this.state.token}
                            isOpen={this.state.isOpenArticleModal}
                            onClose={() => this.setState({ isOpenArticleModal: false })}
                            tempPosts={tempPosts}
                            onDelete={this.onDeleteTempPost.bind(this)}
                            onFetch={this.fetchTempPosts.bind(this)}
                        />
                    )
                }}
            />
        );
    }
}

export default Write;
