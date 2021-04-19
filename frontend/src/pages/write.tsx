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
    const { req } = context;
    
    const cookie = req.headers.cookie;
    const { data } = await API.alive(cookie);

    if(data == 'dead') {
        return {
            notFound: true
        };
    }
    
    return {
        props: {
            username: data.username
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
    isOpenArticleModal: boolean;
    tempPosts: {
        token: string;
        title: string;
        date: string;
    }[],
    tempPostsCache: {
        [token: string]: {
            title: string;
            content: string;
            tags: string;
        };
    };
    seriesArray: {
        url: string;
        title: string;
    }[];
}

class Write extends React.Component<Props, State> {
    private saveTimer: any;

    constructor(props: Props) {
        super(props);
        this.state = {
            username: props.username,
            title: '',
            content: '',
            tags: '',
            token: '',
            series: '',
            image: undefined,
            isAutoSave: true,
            isOpenArticleModal: false,
            tempPosts: [],
            tempPostsCache: {},
            seriesArray: []
        };
        Global.appendUpdater('Write', () => {
            this.setState({
                username: Global.state.username,
                isAutoSave: Global.state.isAutoSave,
            });
        });
    }

    /* Component Method */

    async componentDidMount() {
        const { series } = (await API.getSetting('', 'series')).data;
        this.setState({
            seriesArray: series
        });
    
        const { data } = await API.getAllTempPosts();
        if(data.result.length > 0) {
            this.setState({
                tempPosts: data.result
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
            const { data } = await API.getTempPosts(token);
            this.setState({
                title: data.title,
                content: data.textMd,
                tags: data.tag,
                token: data.token,
                tempPostsCache: {
                    ...tempPostsCache,
                    [data.token]: {
                        title: data.title,
                        content: data.textMd,
                        tags: data.tag,
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

    async onSubmit() {
        if(!this.state.title) {
            toast('😅 제목이 비어있습니다.');
            return;
        }
        if(!this.state.tags) {
            toast('😅 키워드를 작성해주세요.');
            return;
        }
        try {
            const formData = new FormData();
            formData.append('title', this.state.title);
            formData.append('text_md', this.state.content);
            formData.append('text_html', blexer(this.state.content));
            if(this.state.image) {
                formData.append('image', this.state.image);
            }
            formData.append('tag', this.state.tags);
            formData.append('series', this.state.series);
            formData.append('token', this.state.token);

            const { data } = await API.postPost('@' + this.state.username, formData);
            Router.push('/[author]/[posturl]', `/@${this.state.username}/${data}`);
        } catch(e) {
            toast('😥 글 작성중 오류가 발생했습니다.');
        }
    }

    async onDeleteTempPost(token: string) {
        if(confirm('😅 정말 임시글을 삭제할까요?')) {
            const { data } = await API.deleteTempPosts(token);
            if(data == 'DONE') {
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
            if(data == 'DONE') {
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
            if(data == 'error:OF') {
                toast('😥 임시 저장글 갯수가 초과했습니다');
                return;
            }
            this.setState({
                token: data,
                tempPosts: this.state.tempPosts.concat({
                    token: data,
                    title: title,
                    date: '0분'
                })
            });
            // TODO: TempPostsArray에 추가
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
            seriesArray
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
                        list: seriesArray,
                        value: this.state.series,
                        onChange: (value: string) => this.setState({series: value}),
                    }}
                    tags={{
                        value: this.state.tags,
                        onChange: (value: string) => this.setState({tags: value}),
                    }}
                    image={{
                        onChange: (image: File) => this.setState({image: image})
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