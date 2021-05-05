import { useEffect, useState } from 'react';

import Modal from '@components/modal/Modal';
import ModalContent from '@components/modal/Content';
import ModalButton from '@components/modal/Button';

import CheckBox from '@components/atoms/check-box';
import ImageForm from '@components/form/ImageForm';
import InputForm from '@components/form/InputForm';
import SelectForm from '@components/form/SelectForm';
import FullLoading from '@components/common/FullLoading';

import EditorTitle from '@components/editor/Title';
import EditorContent from '@components/editor/Content';
import EditorFromsModal from '@components/editor/modal/Forms';
import EditorImageModal from '@components/editor/modal/Image';
import EditorYoutubeModal from '@components/editor/modal/YouTube';

import * as API from '@modules/api';
import { dropImage, uploadImage } from '@modules/image';

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
    isAdvertise: {
        value: boolean;
        onChange: (value: boolean) => void;
    }
    onSubmit: (onFail: Function) => void;
    addon?: {
        sideButton: JSX.Element | JSX.Element[];
        modal: JSX.Element | JSX.Element[];
    }
}

let contentInput: EditorContent | null;

export default function Layout(props: Props) {
    const [ imageName, setImageName ] = useState('');
    const [ imagePreview, setImagePreview ] = useState('');
    const [ isSumbit, setIsSubmit ] = useState(false);
    const [ isEditMode, setIsEditMode ] = useState(true);
    const [ isOepnFormsModal, setIsOpenFormsModal ] = useState(false);
    const [ isOepnImageModal, setIsOpenImageModal ] = useState(false);
    const [ isOepnYoutubeModal, setIsOpenYoutubeModal ] = useState(false);
    const [ isOepnPublishModal, setIsOpenPublishModal ] = useState(false);

    const [ forms, setForms ] = useState<API.GetSettingFormsDataForms[]>();
    const [ series, setSeries ] = useState<API.GetSettingSeriesDataSeries[]>();

    useEffect(() => {
        API.getSettingForms('').then((response) => {
            const { data } = response;
            if (data.body) {
                setForms(data.body.forms);
            }
        });

        API.getSettingSeries('').then((response) => {
            const { data } = response;
            if (data.body) {
                setSeries(data.body.series);
            }
        })
    }, []);

    const appendTextOnCursor = (val: string) => {
        const text = props.content.value;
        const cursorPos = contentInput?.textarea?.selectionStart;
        if(cursorPos) {
            const preText = text.substr(0, cursorPos);
            const endText = text.substr(cursorPos, text.length - 1);
            props.content.onChange(preText + '\n' + val + '\n' + endText);
        } else {
            props.content.onChange(text + '\n' + val);
        }
    }

    const onUploadImage = async (image: File) => {
        const link = await uploadImage(image);
        if(link) {
            const imageMd = link.includes('.mp4') ? `@gif[${link}]` : `![](${link})`;
            appendTextOnCursor(imageMd);
        }
    }

    const onDropImage = async (e: DragEvent) => {
        const link = await dropImage(e);
        if(link) {
            const imageMd = link.includes('.mp4') ? `@gif[${link}]` : `![](${link})`;
            appendTextOnCursor(imageMd);
        }
    }

    const onUploadYoutube = (id: string) => {
        if(id) {
            const youtubeMd = `@youtube[${id}]`;
            appendTextOnCursor(youtubeMd);
        }
    }

    const onSubmit = async () => {
        setIsSubmit(true);
        await props.onSubmit(() => {
            setIsSubmit(false);
        });
    }

    const onFetchForm = async (id: number) => {
        const { data } = await API.getForm(id);
        if (data.content) {
            appendTextOnCursor(data.content);
        }
    }

    return (
        <div className="container">
            <div className="row justify-content-center">
                <div className="col-lg-8" onDrop={(e: any) => onDropImage(e)}>
                    <EditorTitle
                        value={props.title.value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => props.title.onChange(e.target.value)}
                    />
                    <EditorContent
                        ref={el => contentInput = el}
                        isEditMode={isEditMode}
                        value={props.content.value}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => props.content.onChange(e.target.value)}
                    />
                </div>
                <div className="col-lg-2">
                    <div className="sticky-top sticky-top-100">
                        <div className="share">
                            <ul className="px-3">
                                <li className="mx-3 mx-lg-4" onClick={() => setIsOpenImageModal(true)}>
                                    <i className="far fa-image"/>
                                </li>
                                <li className="mx-3 mx-lg-4" onClick={() => setIsOpenYoutubeModal(true)}>
                                    <i className="fab fa-youtube"/>
                                </li>
                                <li className="mx-3 mx-lg-4" onClick={() => setIsEditMode(isEditMode => !isEditMode)}>
                                    {isEditMode ?
                                        <i className="far fa-eye-slash"/> :
                                        <i className="far fa-eye"/>}
                                </li>
                                <li className="mx-3 mx-lg-4" onClick={() => setIsOpenFormsModal(true)}>
                                    <i className="fab fa-wpforms"></i>
                                </li>
                                {props.addon?.sideButton}
                            </ul>
                        </div>
                    </div>
                </div>

                <Modal title={props.publish.title} isOpen={isOepnPublishModal} close={() => setIsOpenPublishModal(false)}>
                    <ModalContent>
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
                            defaultChecked={props.isAdvertise.value}
                            onClick={(value: boolean) => props.isAdvertise.onChange(value)}
                        />
                    </ModalContent>
                    <ModalButton text={props.publish.buttonText} onClick={() => onSubmit()}/>
                </Modal>

                <EditorImageModal
                    isOpen={isOepnImageModal}
                    close={() => setIsOpenImageModal(false)}
                    onUpload={(image: File) => onUploadImage(image)}
                />

                <EditorYoutubeModal
                    isOpen={isOepnYoutubeModal}
                    close={() => setIsOpenYoutubeModal(false)}
                    onUpload={(id: string) => onUploadYoutube(id)}
                />

                <EditorFromsModal
                    isOpen={isOepnFormsModal}
                    close={() => setIsOpenFormsModal(false)}
                    forms={forms}
                    onFetch={onFetchForm}
                />

                {props.addon?.modal}

                <div
                    className="write-btn"
                    onClick={() => setIsOpenPublishModal(true)}>
                    <i className="fas fa-pencil-alt"></i>
                </div>

                {isSumbit ? <FullLoading/> : ''}
            </div>
        </div>
    )
}