import styles from './Layout.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect, useState } from 'react';

import {
    CheckBox,
    PopOver,
    Loading,
    Modal,
} from '@design-system';

import { EditorTitle } from '../editor-title';
import { EditorContent } from '../editor-content';
import {
    ImageForm,
    InputForm,
    SelectForm
} from '../forms';
import {
    FormsModal,
    ImageModal,
    YoutubeModal
} from '../modals';

import * as API from '@modules/api';
import { dropImage, uploadImage } from '@modules/utility/image';

import { modalStore } from '@stores/modal';

interface Props {
    title: {
        value: string;
        onChange: (value: string) => void;
    },
    content: {
        value: string;
        onChange: (value: string) => void;
    }
    series: {
        value: string;
        onChange: (value: string) => void;
    }
    tags: {
        value: string;
        onChange: (value: string) => void;
    }
    image: {
        onChange: (image: File) => void;
    }
    publish: {
        title: string;
        buttonText: string;
    }
    isHide: {
        value: boolean;
        onChange: (value: boolean) => void;
    }
    isAd: {
        value: boolean;
        onChange: (value: boolean) => void;
    }
    onSubmit: (onFail: Function) => void;
    addon?: {
        sideButton: JSX.Element | JSX.Element[];
        modal: JSX.Element | JSX.Element[];
    }
}

let contentInput: HTMLTextAreaElement | null;

export function EditorLayout(props: Props) {
    const [ imageName, setImageName ] = useState('');
    const [ imagePreview, setImagePreview ] = useState('');
    const [ isSubmit, setIsSubmit ] = useState(false);
    const [ isEditMode, setIsEditMode ] = useState(true);

    const [ isOpenFormsModal, setIsOpenFormsModal ] = useState(false);
    const [ isOpenImageModal, setIsOpenImageModal ] = useState(false);
    const [ isOpenYoutubeModal, setIsOpenYoutubeModal ] = useState(false);
    const [ isOpenPublishModal, setIsOpenPublishModal ] = useState(modalStore.state.isPublishModalOpen);

    const [ forms, setForms ] = useState<API.GetSettingFormsDataForms[]>();
    const [ series, setSeries ] = useState<API.GetSettingSeriesDataSeries[]>();

    useEffect(modalStore.syncValue('isPublishModalOpen', setIsOpenPublishModal), []);
    
    useEffect(() => {
        API.getSettingForms().then((response) => {
            const { data } = response;
            setForms(data.body.forms);
        });

        API.getSettingSeries().then((response) => {
            const { data } = response;
            setSeries(data.body.series);
        })
    }, []);

    const appendTextOnCursor = (val: string) => {
        const text = props.content.value;
        const cursorPos = contentInput?.selectionStart;
        if(cursorPos) {
            const preText = text.substr(0, cursorPos);
            const endText = text.substr(cursorPos, text.length - 1);
            props.content.onChange(preText + '\n' + val + '\n' + endText);
        } else {
            props.content.onChange(text + '\n' + val);
        }
    }

    const onUploadImage = async (image: File) => {
        const imageSrc = await uploadImage(image);
        if(imageSrc) {
            const imageMd = imageSrc.includes('.mp4')
                ? `@gif[${imageSrc}]`
                : `![](${imageSrc})`;
            appendTextOnCursor(imageMd);
        }
    }

    const onDropImage = async (e: React.DragEvent<HTMLDivElement>) => {
        const imageSrc = await dropImage(e);
        if(imageSrc) {
            const imageMd = imageSrc.includes('.mp4')
                ? `@gif[${imageSrc}]`
                : `![](${imageSrc})`;
            appendTextOnCursor(imageMd);
        }
    }

    const onUploadYoutube = (id: string) => {
        if (id) {
            const youtubeMd = `@youtube[${id}]`;
            appendTextOnCursor(youtubeMd);
        }
    }

    const handleSubmit = async () => {
        modalStore.onCloseModal('isPublishModalOpen');
        setIsSubmit(true);
        await props.onSubmit(() => {
            setIsSubmit(false);
        });
    }

    const onFetchForm = async (id: number) => {
        const { data } = await API.getForm(id);
        if (data.body.content) {
            appendTextOnCursor(data.body.content);
        }
    }

    return (
        <div className="container">
            <div className="row justify-content-center">
                <div
                    className="col-lg-8"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDropImage(e)}
                >
                    <EditorTitle
                        value={props.title.value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => props.title.onChange(e.target.value)}
                    />
                    <EditorContent
                        refer={el => contentInput = el}
                        isEditMode={isEditMode}
                        value={props.content.value}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => props.content.onChange(e.target.value)}
                    />
                </div>

                <Modal
                    title={props.publish.title}
                    isOpen={isOpenPublishModal}
                    onClose={() => modalStore.onCloseModal('isPublishModalOpen')}
                    submitText={props.publish.buttonText}
                    onSubmit={() => handleSubmit()}
                >
                    <ImageForm
                        title="포스트 썸네일"
                        name="image"
                        imageName={imageName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const { files } = e.target;

                            if(files) {
                                const image = files[0];
                                props.image.onChange(image);

                                const reader = new FileReader();

                                reader.onload = (e) => 
                                    setImagePreview(e.target?.result as string);

                                reader.readAsDataURL(image);
                                setImageName(image.name);
                            }
                        }}
                    />
                    <img src={imagePreview} className="w-100"/>
                    <SelectForm
                        name="series"
                        title="시리즈"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => props.series.onChange(e.target.value)}>
                        <>
                            <option value="">선택하지 않음</option>
                            {series?.map((item, idx) => (
                                <option
                                    key={idx}
                                    value={item.url}
                                    selected={props.series.value == item.url ? true : false}>
                                    {item.title}
                                </option>
                            ))}
                        </>
                    </SelectForm>
                    <InputForm
                        title="키워드"
                        type="text"
                        name="tags"
                        maxLength={50}
                        value={props.tags.value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => props.tags.onChange(e.target.value)}
                        placeholder="띄어쓰기 혹은 반점으로 구분하세요."
                    />
                    <CheckBox
                        label="포스트를 숨깁니다."
                        defaultChecked={props.isHide.value}
                        onClick={(value: boolean) => props.isHide.onChange(value)}
                    />
                    <CheckBox
                        label="포스트에 광고가 있습니다."
                        defaultChecked={props.isAd.value}
                        onClick={(value: boolean) => props.isAd.onChange(value)}
                    />
                </Modal>

                <ImageModal
                    isOpen={isOpenImageModal}
                    onClose={() => setIsOpenImageModal(false)}
                    onUpload={(image) => image && onUploadImage(image)}
                />

                <YoutubeModal
                    isOpen={isOpenYoutubeModal}
                    onClose={() => setIsOpenYoutubeModal(false)}
                    onUpload={(id) => onUploadYoutube(id)}
                />

                <FormsModal
                    isOpen={isOpenFormsModal}
                    onClose={() => setIsOpenFormsModal(false)}
                    forms={forms}
                    onFetch={onFetchForm}
                />

                {props.addon?.modal}

                {isSubmit ? <Loading block/> : ''}
            </div>
        </div>
    )
}