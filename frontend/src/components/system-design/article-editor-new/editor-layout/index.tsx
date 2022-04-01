import { useEffect, useState } from 'react';

import {
    CheckBox,
    Loading,
    Modal,
    Carousel,
} from '@design-system';

import { EditorTitle } from '../editor-title';
import { EditorContent } from '../editor-content';
import {
    ImageForm,
    InputForm,
    SelectForm
} from '../forms';

import * as API from '@modules/api';

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

    const handleSubmit = async () => {
        modalStore.onCloseModal('isPublishModalOpen');
        setIsSubmit(true);
        await props.onSubmit(() => {
            setIsSubmit(false);
        });
    }

    return (
        <div className="container">
            <div className="row justify-content-center">
                <div className="col-lg-8">
                    <EditorTitle
                        value={props.title.value}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => props.title.onChange(e.target.value)}
                    />
                    <EditorContent
                        value={props.content.value}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => props.content.onChange(e.target.value)}
                    />
                    <div className="shallow-dark text-center mt-3">
                        <Carousel items={[
                            <p>
                                본문으로 이미지를 드래그하여 간편하게 업로드 할 수 있습니다.
                            </p>,
                            <p>
                                마크다운을 이용하여 본문의 내용을 작성할 수 있습니다.
                            </p>,
                        ]}/>
                    </div>
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

                {isSubmit ? <Loading block/> : ''}
            </div>
        </div>
    )
}