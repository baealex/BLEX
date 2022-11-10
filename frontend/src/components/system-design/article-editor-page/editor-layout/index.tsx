import {
    useEffect,
    useState
} from 'react';
import { useValue } from 'badland-react';

import {
    CheckBox,
    Loading,
    Modal
} from '@design-system';

import {
    EditorContent,
    EditorContentProps
} from '../editor-content';
import {
    KeywordForm,
    SelectForm
} from '../forms';
import { EditorTitle } from '../editor-title';

import * as API from '~/modules/api';

import { modalStore } from '~/stores/modal';

interface Props {
    title: {
        value: string;
        onChange: (value: string) => void;
    };
    content: {
        value: string;
        onChange: (value: string) => void;
    };
    series: {
        value: string;
        onChange: (value: string) => void;
    };
    tags: {
        value: string;
        onChange: (value: string) => void;
    };
    image: {
        onChange: (image: File) => void;
    };
    publish: {
        title: string;
        buttonText: string;
    };
    isHide: {
        value: boolean;
        onChange: (value: boolean) => void;
    };
    isAd: {
        value: boolean;
        onChange: (value: boolean) => void;
    };
    onSubmit: (onFail: () => void) => void;
    addon?: EditorContentProps['addon'];
}

export function EditorLayout(props: Props) {
    const [ isSubmit, setIsSubmit ] = useState(false);

    const [ isOpenPublishModal ] = useValue(modalStore, 'isPublishModalOpen');

    const [ series, setSeries ] = useState<API.GetSettingSeriesResponseData['series']>();

    useEffect(() => {
        API.getSettingSeries().then((response) => {
            const { data } = response;
            setSeries(data.body.series);
        });

        const handleDropEvent = (e: DragEvent) => {
            e.preventDefault();
        };

        document.body.addEventListener('dragover', handleDropEvent);
        document.body.addEventListener('drop', handleDropEvent);

        return () => {
            document.body.removeEventListener('dragover', handleDropEvent);
            document.body.removeEventListener('drop', handleDropEvent);
        };
    }, []);

    const handleSubmit = async () => {
        modalStore.close('isPublishModalOpen');
        setIsSubmit(true);
        await props.onSubmit(() => {
            setIsSubmit(false);
        });
    };

    return (
        <div className="x-container">
            <EditorTitle
                value={props.title.value}
                onChange={props.title.onChange}
                onChangeImage={props.image.onChange}
            />
            <EditorContent
                value={props.content.value}
                onChange={props.content.onChange}
                addon={props.addon}
            />
            <Modal
                title={props.publish.title}
                isOpen={isOpenPublishModal}
                onClose={() => modalStore.close('isPublishModalOpen')}
                submitText={props.publish.buttonText}
                onSubmit={() => handleSubmit()}>
                <SelectForm
                    className="mb-3"
                    name="series"
                    label="시리즈 (옵션)"
                    onChange={(e) => props.series.onChange(e.target.value)}>
                    <>
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
                <KeywordForm
                    className="mb-3"
                    label="태그 (필수)"
                    type="text"
                    name="tags"
                    maxLength={50}
                    value={props.tags.value}
                    onChange={(e) => props.tags.onChange(e.target.value)}
                    placeholder=""
                />
                <CheckBox
                    label="포스트를 숨깁니다."
                    defaultChecked={props.isHide.value}
                    onClick={(e) => props.isHide.onChange(e.currentTarget.checked)}
                />
                <CheckBox
                    label="포스트에 광고가 있습니다."
                    defaultChecked={props.isAd.value}
                    onClick={(e) => props.isAd.onChange(e.currentTarget.checked)}
                />
            </Modal>

            {props.addon?.modal}

            {isSubmit && <Loading isFullPage />}
        </div>
    );
}
