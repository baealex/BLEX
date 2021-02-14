import React from 'react';
import Head from 'next/head';
import Router from 'next/router';

import { toast } from 'react-toastify';

import FullLoading from '@components/common/FullLoading';

import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import ModalButton from '@components/modal/Button';

import ImageForm from '@components/form/ImageForm';
import SelectForm from '@components/form/SelectForm';
import InputForm from '@components/form/InputForm';

import EditorTitle from '@components/editor/Title';
import EditorContent from '@components/editor/Content';
import EditorArticleModal from '@components/editor/modal/Article';
import EditorImageModal from '@components/editor/modal/Image';
import EditorYoutubeModal from '@components/editor/modal/YouTube';

import * as API from '@modules/api';
import { lazyLoadResource } from '@modules/lazy';
import blexer from '@modules/blexer';
import Global from '@modules/global';
import Prism from '@modules/library/prism';
import { dropImage, uploadImage } from '@modules/image';

const modal = {
    publish: 'isOpenPublishModal',
    article: 'isOpenArticleModal',
    youtube: 'isOpenYouTubeModal',
    image: 'isOpenImageModal'
};

class Write extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            username: Global.state.username,
            title: '',
            tags: '',
            text: '',
            isEdit: true,
            token: '',
            series: '',
            image: '',
            imageName: '',
            isSumbit: false,
            isOpenPublishModal: false,
            isOpenArticleModal: false,
            isOpenYouTubeModal: false,
            isOpenImageModal: false,
            editor: undefined,
            tempPosts: [],
            tempPostsCache: {},
            seriesArray: []
        };
        Global.appendUpdater('Write', () => {
            this.setState({
                username: Global.state.username,
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
                    seriesArray: data.series
                });
            }
    
            {
                const { data } = await API.getAllTempPosts();
                if(data.result.length > 0) {
                    this.setState({
                        tempPosts: data.result
                    });
                    toast('😀 작성하던 포스트가 있으시네요!', {
                        onClick: () => {
                            this.onOpenModal(modal.article);
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
            title: '',
            text: '',
            tags: '',
            token: ''
        });
    }

    onOpenModal(name) {
        this.setState({
            [name]: true
        });
    }

    onCloseModal(name) {
        this.setState({
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
        this.setState({ text: value });
        clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => {
            this.onTempSave();
        }, 5000);
    }

    onEditorMount(editor) {
        this.setState({ editor });
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
                isSumbit: true
            });
            const { data } = await API.postPost('@' + this.state.username, formData);
            Router.push('/[author]/[posturl]', `/@${this.state.username}/${data}`);
        } catch(e) {
            this.setState({
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
                title
            });
        }

        if(token) {
            const { data } = await API.putTempPosts(token, title, text, tags);
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
                            text: this.state.text,
                            tags: this.state.tags
                        }
                    }
                });
                toast('😀 임시 저장이 완료되었습니다.');
            }
        } else {
            const { data } = await API.postTempPosts(title, text, tags);
            if(data == 'error:OF') {
                toast('😥 임시 저장은 5개만 가능해요.');
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

    onSelectImage() {
        this.thumbnail.click();
    }

    onChangeImage(e) {
        const { files } = e.target;
        const [ file ] = files;
        this.setState({
            image: file,
            imageName: file.name
        });
    }

    async onUploadImage(image) {
        const link = await uploadImage(image);
        if(link) {
            const imageMd = link.includes('.mp4') ? `@gif[${link}]` : `![](${link})`;
            this.setState({
                text: this.state.text += '\n' + imageMd + '\n'
            });
        }
    }

    onUploadYoutube(id) {
        if(id) {
            const youtubeMd = `@youtube[${id}]`;
            this.setState({
                text: this.state.text += '\n' + youtubeMd + '\n'
            });
        }
    }

    render() {
        const {
            tempPosts,
            seriesArray,
            imageName
        } = this.state;

        const publishModal = (
            <Modal title='게시글 발행' isOpen={this.state[modal.publish]} close={() => this.onCloseModal(modal.publish)}>
                <ModalContent>
                    <ImageForm
                        title="대표 이미지 선택"
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
                </ModalContent>
                <ModalButton text="글을 발행합니다" onClick={() => this.onPublish()}/>
            </Modal>
        );

        return (
            <>
                <Head>
                    <title>Write — BLEX</title>
                </Head>

                <div className="container">
                    <div className="row justify-content-center">
                        <div className="col-lg-8">
                            <EditorTitle
                                title={this.state.title}
                                onChange={(e) => this.setState({
                                    title: e.target.value
                                })}
                            />
                            <EditorContent
                                text={this.state.text}
                                isEdit={this.state.isEdit}
                                onChange={(e) => this.setState({
                                    text: e.target.value
                                })}
                            />
                        </div>
                        <div className="col-lg-2">
                            <div className="sticky-top sticky-top-100">
                                <div className="share">
                                    <ul className="px-3">
                                        <li className="mx-3 mx-lg-4" onClick={() => this.onOpenModal(modal.image)}>
                                            <i className="far fa-image"></i>
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => this.onOpenModal(modal.youtube)}>
                                            <i className="fab fa-youtube"></i>
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => this.setState({isEdit: !this.state.isEdit})}>
                                            {this.state.isEdit ? <i className="far fa-eye-slash"></i> : <i className="far fa-eye"></i>}
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => this.onOpenModal(modal.article)}>
                                            <i className="far fa-save"></i>
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => {
                                            if(confirm('🤔 이 링크는 노션으로 연결됩니다. 연결하시겠습니까?')) {
                                                window.open('about:blank').location.href = '//notion.so/b3901e0837ec40e3983d16589314b59a';
                                            }
                                        }}>
                                            <i className="fas fa-question"></i>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <EditorArticleModal
                    token={this.state.token}
                    isOpen={this.state[modal.article]}
                    close={() => this.onCloseModal(modal.article)}
                    tempPosts={tempPosts}
                    onDelete={(token) => this.onDeleteTempPost(token)}
                    onFecth={(token) => this.fecthTempPosts(token)}
                    onSave={() => this.onTempSave()}
                />

                <EditorImageModal
                    isOpen={this.state[modal.image]}
                    close={() => this.onCloseModal(modal.image)}
                    onUpload={(image) => this.onUploadImage(image)}
                />

                <EditorYoutubeModal
                    isOpen={this.state[modal.youtube]}
                    close={() => this.onCloseModal(modal.youtube)}
                    onUpload={(id) => this.onUploadYoutube(id)}
                />

                {publishModal}

                <div
                    className="write-btn"
                    onClick={() => this.onOpenModal(modal.publish)}>
                    <i className="far fa-paper-plane"></i>
                </div>
                
                {this.state.isSumbit ? <FullLoading/> : ''}
            </>
        )
    }
}

export default Write;