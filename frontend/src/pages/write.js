import React from 'react';
import Head from 'next/head';
import Router from 'next/router';

import Modal from '@components/common/Modal';
import FullLoading from '@components/common/FullLoading';
import ImageForm from '@components/form/ImageForm';
import SelectForm from '@components/form/SelectForm';
import InputForm from '@components/form/InputForm';
import ArticleContent from '@components/article/ArticleContent';

import { toast } from 'react-toastify';
import { Controlled as CodeMirror } from 'react-codemirror2'

import API from '@modules/api';
import { lazyLoadResource } from '@modules/lazy';
import blexer from '@modules/blexer';
import Global from '@modules/global';
import Prism from '@modules/library/prism';
import { dropImage } from '@modules/image';

const modal = {
    publish: 'isOpenPublishModal',
    tempPosts: 'isOpenTempPostsModal'
};

class Write extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            username: Global.state.username,
            title: '',
            tags: '',
            text: '',
            token: '',
            series: '',
            image: '',
            imageName: '',
            isSumbit: false,
            isOpenPublishModal: false,
            isOpenTempPostsModal: false,
            editor: undefined,
            tempPosts: [],
            tempPostsCache: {},
            seriesArray: [],
            isNightMode: Global.state.isNightMode
        };
        Global.appendUpdater('Write', () => {
            this.setState({
                ...this.state,
                username: Global.state.username,
                isNightMode: Global.state.isNightMode
            });
        });
        this.preview = undefined;
        this.thumbnail = undefined;
        this.saveTimer = undefined;
    }

    /* Component Method */

    async componentDidMount() {
        const sleep = (ms) => {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        let forceBreakCounter = 0;
        while(true) {
            await sleep(10);
            if(forceBreakCounter > 50 || this.state.username != '') {
                break;
            }
            forceBreakCounter++;
        }

        const { username } = this.state;

        if(username == '') {
            Router.back();
        } else {
            {
                const { data } = await API.getSetting('@' + username, 'series');
                this.setState({
                    ...this.state,
                    seriesArray: data.series
                });
            }
    
            {
                const { data } = await API.getAllTempPosts();
                if(data.result.length > 0) {
                    this.setState({
                        ...this.state,
                        tempPosts: data.result
                    });
                    toast('😀 작성하던 포스트가 있으시네요!', {
                        onClick: () => {
                            this.onOpenModal(modal.tempPosts);
                        }
                    });
                }
            }
        }
    }

    componentDidUpdate(prevState) {
        if (prevState.text !== this.state.text) {
            Prism.highlightAll();
            lazyLoadResource();
        }
    }

    /* Inner Method */

    async fecthTempPosts(token='') {
        if(token) {
            const { tempPostsCache } = this.state;
            
            // 캐시가 존재하는 경우
            if(tempPostsCache[token]) {
                const { title, text, tags } = tempPostsCache[token];
                this.setState({
                    ...this.state,
                    title,
                    text,
                    tags,
                    token
                });
                return;
            }
            // 캐시 없을 때
            const { data } = await API.getTempPosts(token);
            this.setState({
                ...this.state,
                title: data.title,
                text: data.textMd,
                tags: data.tag,
                token: data.token,
                tempPostsCache: {
                    ...tempPostsCache,
                    [data.token]: {
                        title: data.title,
                        text: data.textMd,
                        tags: data.tag,
                    }
                }
            });
            return;
        }
        // 새 글 작성
        this.setState({
            ...this.state,
            title: '',
            text: '',
            tags: '',
            token: ''
        });
    }

    onOpenModal(name) {
        this.setState({
            ...this.state,
            [name]: true
        });
    }

    onCloseModal(name) {
        this.setState({
            ...this.state,
            [name]: false
        });
    }

    async onImageDrop(e) {
        const link = await dropImage(e);
        if(link) {
            const doc = this.state.editor.getDoc();
            const imageMd = link.includes('.mp4') ? `@gif[${link}]` : `![](${link})`;
            doc.replaceRange(imageMd, doc.getCursor());
        }
    }

    onEditorChange(value) {
        this.setState({ ...this.state, text: value });
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.onTempSave();
        }, 5000);
    }

    onEditorMount(editor) {
        this.setState({ ...this.state, editor });
    }

    onEditorScroll(data) {
        const rate = (data.top / data.height) * 100;
        const previewTop = (rate * this.preview.scrollHeight) / 100;
        this.preview.scrollTop = previewTop;
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
    }

    async onPublish() {
        if(!this.state.title) {
            toast('😅 제목이 비어있습니다.');
            return;
        }
        if(!this.state.tags) {
            toast('😅 키워드를 작성해주세요.');
            return;
        }
        const formData = new FormData();
        formData.append('title', this.state.title);
        formData.append('text_md', this.state.text);
        formData.append('text_html', blexer(this.state.text));
        if(this.state.image) {
            formData.append('image', this.state.image);
        }
        formData.append('tag', this.state.tags);
        formData.append('series', this.state.series);
        formData.append('token', this.state.token);
        try {
            this.setState({
                ...this.state,
                isSumbit: true
            });
            const { data } = await API.postPost('@' + this.state.username, formData);
            Router.push('/[author]/[posturl]', `/@${this.state.username}/${data}`);
        } catch(e) {
            this.setState({
                ...this.state,
                isSumbit: false
            });
            toast('😥 글 작성중 오류가 발생했습니다.');
        }
    }

    async onDeleteTempPost(token) {
        if(confirm('😅 정말 임시글을 삭제할까요?')) {
            const { data } = await API.deleteTempPosts(token);
            if(data == 'DONE') {
                this.setState({
                    ...this.state,
                    token: '',
                    tempPosts: this.state.tempPosts.filter(post => 
                        post.token !== token
                    )
                });
                toast('😀 임시글이 삭제되었습니다.');
            }
        }
    }

    async onTempSave() {
        let {
            token,
            title,
            text,
            tags
        } = this.state;

        if(!title) {
            const date = new Date();
            title = date.toLocaleString();
            this.setState({
                ...this.state,
                title
            });
        }

        if(token) {
            const { data } = await API.putTempPosts(token, title, text, tags);
            if(data == 'DONE') {
                this.setState({
                    ...this.state,
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
                            text: this.state.text,
                            tags: this.state.tags
                        }
                    }
                });
                toast('😀 임시 저장이 완료되었습니다.');
            }
        } else {
            const { data } = await API.postTempPosts(title, text, tags);
            if(data == 'Error:EG') {
                toast('😥 임시 저장은 5개만 가능해요.');
                return;
            }
            this.setState({
                ...this.state,
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

    onSelectImage() {
        this.thumbnail.click();
    }

    onChangeImage(e) {
        const { files } = e.target;
        const [ file ] = files;
        this.setState({
            ...this.state,
            image: file,
            imageName: file.name
        });
    }

    render() {
        const {
            tempPosts,
            seriesArray,
            imageName
        } = this.state;

        const tempPostsModal = (
            <Modal title='임시 저장된 글' isOpen={this.state[modal.tempPosts]} close={() => this.onCloseModal(modal.tempPosts)}>
                <div className="content noto">
                    {tempPosts.map((item, idx) => (
                        <div key={idx} className="blex-card p-3 mb-3 d-flex justify-content-between">
                            <span onClick={() => this.fecthTempPosts(item.token)} className={`c-pointer ${this.state.token == item.token ? 'deep-dark' : 'shallow-dark'}`}>
                                {item.title} <span className="vs">{item.date}전</span>
                            </span>
                            <a onClick={() => this.onDeleteTempPost(item.token)}>
                                <i className="fas fa-times"></i>
                            </a>
                        </div>
                    ))}
                    <div className="blex-card p-3 mb-3 d-flex justify-content-between">
                        <span onClick={() => this.fecthTempPosts()} className={`c-pointer ${this.state.token == '' ? 'deep-dark' : 'shallow-dark'}`}>
                            새 글 쓰기
                        </span>
                    </div>
                </div>
                <div className="button" onClick={() => this.onTempSave()}>
                    <button>현재 글 임시저장</button>
                </div>
            </Modal>
        );

        const publishModal = (
            <Modal title='게시글 발행' isOpen={this.state[modal.publish]} close={() => this.onCloseModal(modal.publish)}>
                <div className="content noto">
                    <ImageForm
                        name="image"
                        imageName={imageName}
                        onChange={(e) => this.onChangeImage(e)}
                    />
                    <SelectForm
                        name="series"
                        title="시리즈"
                        onChange={(e) => this.onInputChange(e)}>
                        <option value="">선택하지 않음</option>
                        {seriesArray.map((item, idx) => (
                            <option key={idx} value={item.url}>{item.title}</option>
                        ))}
                    </SelectForm>
                    <InputForm
                        title="키워드"
                        name="tags"
                        maxLength="50"
                        value={this.state.tags}
                        onChange={(e) => this.onInputChange(e)}
                        placeholder="띄어쓰기 혹은 반점으로 구분하세요."
                    />
                </div>
                <div className="button" onClick={() => this.onPublish()}>
                    <button>글을 발행합니다</button>
                </div>
            </Modal>
        );

        return (
            <>
                <Head>
                    <title>Write — BLEX</title>
                </Head>

                <div className="container-fluid blex-editor">
                    <input
                        name="title"
                        className="serif title"
                        placeholder="제목을 입력하세요."
                        value={this.state.title}
                        onChange={(e) => this.onInputChange(e)}
                    />
                    <div className="row">
                        <div className="col-lg-6" onDrop={(e) => this.onImageDrop(e)}>
                            {typeof window !== "undefined" && <CodeMirror
                                value={this.state.text}
                                options={{
                                    mode: 'markdown',
                                    theme: this.state.isNightMode ? 'material-darker' : 'default',
                                    lineNumbers: true,
                                    lineWrapping: true,
                                }}
                                onScroll={(editor, data) => this.onEditorScroll(data)}
                                editorDidMount={(editor) => this.onEditorMount(editor)}
                                onBeforeChange={(editor, data, value) => this.onEditorChange(value)}
                            />}
                        </div>
                        <div className="col-lg-6 preview mobile-disable" ref={(el) => { this.preview = el }}>
                            <ArticleContent html={blexer(this.state.text)} />
                        </div>
                    </div>
                </div>

                {tempPostsModal}

                <div
                    className="write-btn slide"
                    onClick={() => this.onOpenModal(modal.tempPosts)}>
                    <i className="far fa-save"></i>
                </div>

                {publishModal}

                <div
                    className="write-btn"
                    onClick={() => this.onOpenModal(modal.publish)}>
                    <i className="fas fa-pencil-alt"></i>
                </div>
                
                {this.state.isSumbit ? <FullLoading/> : ''}
            </>
        )
    }
}

export default Write;