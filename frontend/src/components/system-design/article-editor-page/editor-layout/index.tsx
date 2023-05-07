import {
    useEffect,
    useState
} from 'react';
import { useValue } from 'badland-react';

import {
    Alert,
    BaseInput,
    CheckBox,
    DateInput,
    ErrorMessage,
    FormControl,
    KeywordInput,
    Label,
    Loading,
    Modal
} from '@design-system';

import {
    EditorContent,
    EditorContentProps
} from '../editor-content';
import { EditorTitle } from '../editor-title';

import * as API from '~/modules/api';
import { slugify } from '~/modules/utility/string';

import { modalStore } from '~/stores/modal';

interface StateValue<T> {
    value: T;
    onChange: (value: T) => void;
}

interface Props {
    title: StateValue<string>;
    content: StateValue<string>;
    tags: StateValue<string>;
    description: StateValue<string>;
    series: StateValue<string>;
    url?: StateValue<string>;
    reservedDate?: StateValue<Date | null>;
    isHide: StateValue<boolean>;
    isAd: StateValue<boolean>;
    image: {
        onChange: (image: File) => void;
    };
    publish: {
        title: string;
        buttonText: string;
    };
    onSubmit: (onFail: () => void) => void;
    addon?: EditorContentProps['addon'];
    extended?: {
        footer: React.ReactNode;
    };
}

export function EditorLayout(props: Props) {
    const [isSubmit, setIsSubmit] = useState(false);
    const [reservedDateErrorMessage, setReserverdDateErrorMessage] = useState<string | null>(null);

    const [isOpenArticlePublishModal] = useValue(modalStore, 'isOpenArticlePublishModal');

    const [series, setSeries] = useState<API.GetSettingSeriesResponseData['series']>();

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
        modalStore.close('isOpenArticlePublishModal');
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
            <FormControl className="mb-3" required>
                <Label>태그</Label>
                <KeywordInput
                    name="tags"
                    maxLength={50}
                    value={props.tags.value}
                    onChange={(e) => props.tags.onChange(e.target.value)}
                />
            </FormControl>
            {props.extended?.footer}
            <Modal
                title={props.publish.title}
                isOpen={isOpenArticlePublishModal}
                onClose={() => modalStore.close('isOpenArticlePublishModal')}
                submitText={props.publish.buttonText}
                onSubmit={() => handleSubmit()}>
                {props.url && (
                    <FormControl className="mb-3">
                        <Label>URL (옵션)</Label>
                        <BaseInput
                            tag="input"
                            name="url"
                            value={props.url.value}
                            maxLength={50}
                            onChange={(e) => props.url?.onChange(slugify(e.target.value))}
                            placeholder="미작성시 제목을 기반으로 생성됩니다 (최대 50자)"
                        />
                        {props.url.value && (
                            <Alert className="mt-2" type="warning">
                                URL은 한번 설정하면 변경할 수 없습니다. 입력한 URL이 이미 존재하는 경우 임의의 값이 추가됩니다.
                            </Alert>
                        )}
                    </FormControl>

                )}
                <FormControl className="mb-3">
                    <Label>설명 (옵션)</Label>
                    <BaseInput
                        tag="textarea"
                        name="series"
                        value={props.description.value}
                        maxLength={250}
                        onChange={(e) => props.description.onChange(e.target.value)}
                        placeholder="포스트 목록이나 문서의 메타 태그에 표기됩니다. 미작성시 글 요약이 서론 내용을 기반으로 생성됩니다 (최대 250자)"
                    />
                </FormControl>
                <FormControl className="mb-3">
                    <Label>시리즈 (옵션)</Label>
                    <BaseInput
                        tag="select"
                        name="series"
                        icon={(<i className="fas fa-book" />)}
                        onChange={(e) => props.series.onChange(e.target.value)}>
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
                    </BaseInput>
                </FormControl>
                {props.reservedDate && (
                    <FormControl className="mb-3" invalid={!!reservedDateErrorMessage}>
                        <Label>발행 예약 (옵션)</Label>
                        <DateInput
                            placeholder="즉시 발행"
                            showTime
                            minDate={new Date()}
                            selected={props.reservedDate.value}
                            onChange={(date) => {
                                if (date === null) {
                                    setReserverdDateErrorMessage(null);
                                    props.reservedDate?.onChange(null);
                                    return;
                                }
                                if (date < new Date()) {
                                    if (props.reservedDate?.value === null) {
                                        props.reservedDate?.onChange(new Date());
                                    }
                                    setReserverdDateErrorMessage('예약 발행일은 현재 시간보다 이전일 수 없습니다.');
                                    return;
                                }
                                setReserverdDateErrorMessage(null);
                                props.reservedDate?.onChange(date);
                            }}
                        />
                        <ErrorMessage>
                            {reservedDateErrorMessage}
                        </ErrorMessage>
                    </FormControl>
                )}
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

            {isSubmit && <Loading position="full" />}
        </div >
    );
}
