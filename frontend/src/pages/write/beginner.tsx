import React from 'react';
import Router from 'next/router';
import type {
    GetServerSidePropsContext,
    GetServerSidePropsResult,
} from 'next';

import {
    EditorLayout,
} from '@components/system-design/article-editor-page/beginner';

import * as API from '@modules/api';
import {
    snackBar
} from '@modules/ui/snack-bar';

import { configStore } from '@stores/config';
import { authStore } from '@stores/auth';

interface Props {
    username: string;
};

export async function getServerSideProps({
    req,
}: GetServerSidePropsContext
): Promise<GetServerSidePropsResult<Props>> {
    const { cookies } = req;
    configStore.serverSideInject(cookies);

    const { cookie } = req.headers;
    const { data } = await API.getLogin({
        'Cookie': cookie || '',
    });

    if (data.status !== 'DONE') {
        return {
            notFound: true,
        };
    }
    
    return {
        props: {
            username: data.body.username
        }
    };
}

interface State {
    username: string;
    title: string;
    tags: string;
    contents: [];
    token: string;
    series: string;
    image: File | undefined;
    isAutoSave: boolean;
    isHide: boolean;
    isAd: boolean;
    isOpenArticleModal: boolean;
    tempPosts: API.GetTempPostsDataTemp[],
    tempPostsCache: {
        [token: string]: {
            title: string;
            content: string;
            tags: string;
        };
    };
}

class Write extends React.Component<Props, State> {
    private authUpdateKey: string;
    private configUpdateKey: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            username: props.username,
            title: '',
            contents: [],
            tags: '',
            token: '',
            series: '',
            isHide: false,
            isAd: false,
            image: undefined,
            isAutoSave: configStore.state.isAutoSave,
            isOpenArticleModal: false,
            tempPosts: [],
            tempPostsCache: {}
        };
        this.authUpdateKey = authStore.subscribe((state) => {
            this.setState({
                username: state.username,
            });
        });
        this.configUpdateKey = configStore.subscribe((state) => {
            this.setState({
                isAutoSave: state.isAutoSave,
            });
        });
    }

    /* Component Method */

    componentWillUnmount() {
        configStore.unsubscribe(this.configUpdateKey);
        authStore.unsubscribe(this.authUpdateKey);
    }

    async componentDidMount() {
        const { data } = await API.getTempPosts();
        if(data.body.temps.length > 0) {
            this.setState({
                tempPosts: data.body.temps
            });
            snackBar('😀 작성하던 포스트가 있으시네요!', {
                onClick: () => {
                    this.setState({isOpenArticleModal: true});
                }
            });
        }
    }

    async onSubmit(onFail: Function) {
        if(!this.state.title) {
            snackBar('😅 제목이 비어있습니다.');
            onFail();
            return;
        }
        if(!this.state.tags) {
            snackBar('😅 키워드를 작성해주세요.');
            onFail();
            return;
        }
        try {
            const { data } = await API.postPosts({
                token: this.state.token,
                title: this.state.title,
                text_md: this.state.contents.map(({ text }) => {
                    if (text) {
                        return text;
                    }
                    return '<br/>';
                }).join('\n\n'),
                image: this.state.image,
                tag: this.state.tags,
                series: this.state.series,
                is_hide: JSON.stringify(this.state.isHide),
                is_advertise: JSON.stringify(this.state.isAd),
            });
            Router.push('/[author]/[posturl]', `/@${this.state.username}/${data.body.url}`);
        } catch(e) {
            snackBar('😥 글 작성중 오류가 발생했습니다.');
            onFail();
        }
    }

    async onDeleteTempPost(token: string) {
        if(confirm('😅 정말 임시글을 삭제할까요?')) {
            const { data } = await API.deleteTempPosts(token);
            if(data.status === 'DONE') {
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

    onCheckAutoSave(checked: boolean) {
        configStore.set((state) => ({
            ...state,
            isAutoSave: checked
        }));
    }

    render() {
        return (
            <EditorLayout
                title={{
                    value: this.state.title,
                    onChange: (value: string) => this.setState({title: value}),
                }}
                content={{
                    value: this.state.contents,
                    onChange: (value) => {
                        console.log(value);
                        this.setState({contents: value});
                    },
                }}
                series={{
                    value: this.state.series,
                    onChange: (value) => this.setState({series: value}),
                }}
                tags={{
                    value: this.state.tags,
                    onChange: (value) => this.setState({tags: value}),
                }}
                isHide={{
                    value: this.state.isHide,
                    onChange: (value) => this.setState({isHide: value})
                }}
                isAd={{
                    value: this.state.isAd,
                    onChange: (value) => this.setState({isAd: value})
                }}
                image={{
                    onChange: (image) => this.setState({image: image})
                }}
                publish={{
                    title: "포스트 발행",
                    buttonText: "이대로 발행하겠습니다"
                }}
                onSubmit={this.onSubmit.bind(this)}
            />
        )
    }
}

export default Write;