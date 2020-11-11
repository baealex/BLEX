import React from 'react';
import Head from 'next/head';
import Router from 'next/router';

import { toast } from 'react-toastify';
import { Controlled as CodeMirror } from 'react-codemirror2'

import Modal from '@components/common/Modal';
import InputForm from '@components/form/InputForm';
import SelectForm from '@components/form/SelectForm';
import ArticleContent from '@components/article/ArticleContent';

import API from '@modules/api';
import blexer from '@modules/blexer';
import Global from '@modules/global';
import lazyLoad from '@modules/lazy';
import Prism from '@modules/library/prism';
import { dropImage } from '@modules/image';

export async function getServerSideProps(context) {
    const { id } = context.query;
    return { props: { id } };
}

const modal = {
    publish: 'isOpenPublishModal',
};

class Edit extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            username: Global.state.username,
            title: '',
            tags: '',
            text: '',
            url: props.id,
            series: '',
            image: '',
            imageName: '',
            isOpenPublishModal: false,
            editor: undefined,
            seriesArray: [],
            isNightMode: Global.state.isNightMode
        };
        Global.appendUpdater('Edit', () => {
            this.setState({
                ...this.state,
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

        const { username, url } = this.state;

        try {
            const { data } = await API.getPost('@' + username, url, 'edit');
            this.setState({
                ...this.state,
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

        {
            const { data } = await API.getSetting('@' + username, 'series');
            this.setState({
                ...this.state,
                seriesArray: data.series
            });
        }
    }

    componentDidUpdate(prevState) {
        if (prevState.text !== this.state.text) {
            Prism.highlightAll();
            lazyLoad();
        }
    }

    /* Inner Method */

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
        const { url } = this.state;
        if(!this.state.title) {
            toast('😅 제목이 비어있습니다.');
            return;
        }
        if(!this.state.tags) {
            toast('😅 키워드를 작성해주세요.');
            return;
        }
        const { data } = await API.putPost('@' + this.state.username, url, 'edit', {
            title: this.state.title,
            text_md: this.state.text,
            text_html: blexer(this.state.text),
            series: this.state.series,
            tag: this.state.tags
        });
        if(data == 'DONE') {
            Router.push('/[author]/[posturl]', `/@${this.state.username}/${url}`);
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
            seriesArray,
            imageName,
            series
        } = this.state;

        const publishModal = (
            <Modal title='게시글 수정' isOpen={this.state[modal.publish]} close={() => this.onCloseModal(modal.publish)}>
                <div className="content noto">
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
                </div>
                <div className="button" onClick={() => this.onPublish()}>
                    <button>글을 수정합니다</button>
                </div>
            </Modal>
        );

        return (
            <>
                <Head>
                    <title>Edit — BLEX</title>
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

                {publishModal}

                <a onClick={() => this.onOpenModal(modal.publish)}>
                    <div className="write-btn">
                        <i className="fas fa-pencil-alt"></i>
                    </div>
                </a>
            </>
        )
    }
}

export default Edit;