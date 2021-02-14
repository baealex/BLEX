import React from 'react';
import Head from 'next/head';
import Router from 'next/router';

import { toast } from 'react-toastify';

import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import ModalButton from '@components/modal/Button';

import InputForm from '@components/form/InputForm';
import SelectForm from '@components/form/SelectForm';
import FullLoading from '@components/common/FullLoading';

import EditorTitle from '@components/editor/Title';
import EditorContent from '@components/editor/Content';
import EditorImageModal from '@components/editor/modal/Image';
import EditorYoutubeModal from '@components/editor/modal/YouTube';

import * as API from '@modules/api';
import blexer from '@modules/blexer';
import Global from '@modules/global';
import { lazyLoadResource } from '@modules/lazy';
import Prism from '@modules/library/prism';
import { dropImage, uploadImage } from '@modules/image';

export async function getServerSideProps(context) {
    const { id } = context.query;
    return { props: { id } };
}

const modal = {
    publish: 'isOpenPublishModal',
    youtube: 'isOpenYouTubeModal',
    image: 'isOpenImageModal'
};

class Edit extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            username: Global.state.username,
            title: '',
            tags: '',
            text: '',
            isEdit: true,
            series: '',
            image: '',
            imageName: '',
            isSumbit: false,
            isOpenPublishModal: false,
            isOpenYouTubeModal: false,
            isOpenImageModal: false,
            editor: undefined,
            seriesArray: [],
            isNightMode: Global.state.isNightMode
        };
        Global.appendUpdater('Edit', () => {
            this.setState({
                username: Global.state.username,
                isNightMode: Global.state.isNightMode
            });
        });
        this.preview = undefined;
        this.thumbnail = undefined;
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

        this.fetchEditData();

        const { data } = await API.getSetting('@' + username, 'series');
        this.setState({
            seriesArray: data.series
        });
    }

    async fetchEditData() {
        const { username } = this.state;

        try {
            const { data } = await API.getPost('@' + username, this.props.id, 'edit');
            this.setState({
                title: data.title,
                series: data.series,
                imageName: data.image,
                text: data.textMd,
                tags: data.tag
            });
        } catch(error) {
            const { status } = error.response;
            if(status === 404) {
                Router.replace('/write');
            }
        }
    }

    componentDidUpdate(prevProps, prevState) {
        if (prevState.text !== this.state.text) {
            Prism.highlightAll();
            lazyLoadResource();
        }

        if (prevProps.id !== this.props.id) {
            this.fetchEditData();
        }
    }

    /* Inner Method */

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
        this.setState({
            text: value
        });
    }

    onEditorMount(editor) {
        this.setState({
            editor
        });
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
        try {
            this.setState({
                isSumbit: true
            });
            const { data } = await API.putPost('@' + this.state.username, this.props.id, 'edit', {
                title: this.state.title,
                text_md: this.state.text,
                text_html: blexer(this.state.text),
                series: this.state.series,
                tag: this.state.tags
            });
            if(data == 'DONE') {
                Router.push('/[author]/[posturl]', `/@${this.state.username}/${this.props.id}`);
            }
        } catch(e) {
            this.setState({
                isSumbit: false
            });
            toast('😥 글 수정중 오류가 발생했습니다.');
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
            seriesArray,
            imageName,
            series
        } = this.state;

        const publishModal = (
            <Modal title='게시글 수정' isOpen={this.state[modal.publish]} close={() => this.onCloseModal(modal.publish)}>
                <ModalContent>
                    {/*
                    <ImageForm
                        name="image"
                        imageName={imageName}
                        onChange={(e) => this.onChangeImage(e)}
                    />
                    */}
                    <SelectForm
                        name="series"
                        title="시리즈"
                        onChange={(e) => this.onInputChange(e)}>
                        <option value="">선택하지 않음</option>
                        {seriesArray.map((item, idx) => (
                            <option key={idx} value={item.url} selected={series == item.url ? true : false}>{item.title}</option>
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
                <ModalButton text="글을 수정합니다" onClick={() => this.onPublish()}/>
            </Modal>
        );

        return (
            <>
                <Head>
                    <title>Edit — BLEX</title>
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
                                        <li className="mx-3 mx-lg-4" onClick={() => {}}>
                                            <i className="fab fa-youtube"></i>
                                        </li>
                                        <li className="mx-3 mx-lg-4" onClick={() => this.setState({isEdit: !this.state.isEdit})}>
                                            {this.state.isEdit ? <i className="far fa-eye-slash"></i> : <i className="far fa-eye"></i>}
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

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
                    <i className="fas fa-pencil-alt"></i>
                </div>
                
                {this.state.isSumbit ? <FullLoading/> : ''}
            </>
        )
    }
}

export default Edit;