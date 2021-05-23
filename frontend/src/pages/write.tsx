import React from 'react';
import Router from 'next/router';
import { toast } from 'react-toastify';

import EditorLayout from '@components/editor/Layout';
import EditorArticleModal from '@components/editor/modal/Article';

import * as API from '@modules/api';
import blexer from '@modules/blexer';
import Global from '@modules/global';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { cookies } = context.req;
    Global.configInject(cookies);

    const { cookie } = context.req.headers;
    const { data } = await API.getLogin(cookie);

    if(data.status !== 'DONE') {
        return {
            notFound: true
        };
    }
    
    return {
        props: {
            username: data.body.username
        }
    };
}

interface Props {
    username: string;
};

interface State {
    username: string;
    title: string;
    tags: string;
    content: string;
    token: string;
    series: string;
    image: File | undefined;
    isAutoSave: boolean;
    isHide: boolean;
    isAdvertise: boolean;
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
    private saveTimer: any;
    private updateKey: string;

    constructor(props: Props) {
        super(props);
        this.state = {
            username: props.username,
            title: '',
            content: '',
            tags: '',
            token: '',
            series: '',
            isHide: false,
            isAdvertise: false,
            image: undefined,
            isAutoSave: Global.state.isAutoSave,
            isOpenArticleModal: false,
            tempPosts: [],
            tempPostsCache: {}
        };
        this.updateKey = Global.appendUpdater(() => {
            this.setState({
                username: Global.state.username,
                isAutoSave: Global.state.isAutoSave,
            });
        });
    }

    /* Component Method */

    componentWillUnmount() {
        Global.popUpdater(this.updateKey);
    }

    async componentDidMount() {
        const { data } = await API.getTempPosts();
        if(data.body.temps.length > 0) {
            this.setState({
                tempPosts: data.body.temps
            });
            toast('😀 작성하던 포스트가 있으시네요!', {
                onClick: () => {
                    this.setState({isOpenArticleModal: true});
                }
            });
        }
    }

    /* Inner Method */

    async fecthTempPosts(token='') {
        if(token) {
            const { tempPostsCache } = this.state;
            
            // 캐시가 존재하는 경우
            if(tempPostsCache[token]) {
                const { title, content, tags } = tempPostsCache[token];
                this.setState({
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
                title: data.body.title,
                content: data.body.textMd,
                tags: data.body.tag,
                token: data.body.token,
                tempPostsCache: {
                    ...tempPostsCache,
                    [data.body.token]: {
                        title: data.body.title,
                        content: data.body.textMd,
                        tags: data.body.tag,
                    }
                }
            });
            return;
        }

        // 새 글 작성
        this.setState({
            title: '',
            content: '',
            tags: '',
            token: ''
        });
    }

    async onSubmit(onFail: Function) {
        if(!this.state.title) {
            toast('😅 제목이 비어있습니다.');
            onFail();
            return;
        }
        if(!this.state.tags) {
            toast('😅 키워드를 작성해주세요.');
            onFail();
            return;
        }
        try {
            const { data } = await API.postPosts({
                token: this.state.token,
                title: this.state.title,
                text_md: this.state.content,
                text_html: blexer(this.state.content),
                image: this.state.image,
                tag: this.state.tags,
                series: this.state.series,
                is_hide: JSON.stringify(this.state.isHide),
                is_advertise: JSON.stringify(this.state.isAdvertise),
            });
            Router.push('/[author]/[posturl]', `/@${this.state.username}/${data.body.url}`);
        } catch(e) {
            toast('😥 글 작성중 오류가 발생했습니다.');
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
                toast('😀 임시글이 삭제되었습니다.');
            }
        }
    }

    async onTempSave(token: string, title: string, content: string, tags: string) {
        if(!title) {
            const date = new Date();
            title = date.toLocaleString();
            if(this.state.token == token) {
                this.setState({
                    title
                });
            }
        }

        if(token) {
            const { data } = await API.putTempPosts(token, title, content, tags);
            if(data.status === 'DONE') {
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
                    }
                });
                toast('😀 임시 저장이 완료되었습니다.');
            }
        } else {
            const { data } = await API.postTempPosts(title, content, tags);
            if (data.status === 'ERROR') {
                if (data.errorCode === API.ERROR.OVER_FLOW) {
                    toast('😥 임시 저장글 갯수가 초과했습니다');
                    return;    
                }
            }
            this.setState({
                token: data.body.token,
                tempPosts: this.state.tempPosts.concat({
                    token: data.body.token,
                    title: title,
                    createdDate: '0분'
                })
            });
            toast('😀 임시 저장이 완료되었습니다.');
        }
    }

    onCheckAutoSave(checked: boolean) {
        !checked && clearTimeout(this.saveTimer);
        Global.setState({
            isAutoSave: checked
        });
    }

    render() {
        const {
            tempPosts,
        } = this.state;

        return (
            <>
                <EditorLayout
                    title={{
                        value: this.state.title,
                        onChange: (value: string) => this.setState({title: value}),
                    }}
                    content={{
                        value: this.state.content,
                        onChange: (value: string) => {
                            this.setState({content: value});
                            if(this.state.isAutoSave) {
                                clearTimeout(this.saveTimer);
                                this.saveTimer = setTimeout(({
                                    token, title, content, tags
                                } = this.state) => {
                                    this.onTempSave(token, title, content, tags);
                                }, 5000);
                            }
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
                    isAdvertise={{
                        value: this.state.isAdvertise,
                        onChange: (value) => this.setState({isAdvertise: value})
                    }}
                    image={{
                        onChange: (image) => this.setState({image: image})
                    }}
                    publish={{
                        title: "포스트 발행",
                        buttonText: "이대로 발행하겠습니다"
                    }}
                    onSubmit={this.onSubmit.bind(this)}
                    addon={{
                        sideButton: (
                            <>
                                <li className="mx-3 mx-lg-4" onClick={() => this.setState({isOpenArticleModal: true})}>
                                    <i className="far fa-save"></i>
                                </li>
                                <li className="mx-3 mx-lg-4" onClick={() => {
                                    if(confirm('🤔 이 링크는 노션으로 연결됩니다. 연결하시겠습니까?')) {
                                        window.open('about:blank')!.location.href = '//notion.so/b3901e0837ec40e3983d16589314b59a';
                                    }
                                }}>
                                    <i className="fas fa-question"></i>
                                </li>
                            </>
                        ),
                        modal: (
                            <>
                                <EditorArticleModal
                                    token={this.state.token}
                                    isOpen={this.state.isOpenArticleModal}
                                    close={() => this.setState({isOpenArticleModal: false})}
                                    isAutoSave={this.state.isAutoSave}
                                    onCheckAutoSave={(checked: boolean) => this.onCheckAutoSave(checked)}
                                    tempPosts={tempPosts}
                                    onDelete={(token: string) => this.onDeleteTempPost(token)}
                                    onFecth={(token: string) => this.fecthTempPosts(token)}
                                    onSave={() => {
                                        const { token, title, content, tags } = this.state;
                                        this.onTempSave(token, title, content, tags);
                                    }}
                                />
                            </>
                        )
                    }}
                ></EditorLayout>
            </>
        )
    }
}

export default Write;