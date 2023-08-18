import styles from './EditorTitle.module.scss';

import React, {
    useRef,
    useState
} from 'react';

export interface EditorTitleProps {
    value: string;
    disabledImage?: boolean;
    onChange: (value: string) => void;
    onChangeImage?: (image: File) => void;
}

export function EditorTitle(props: EditorTitleProps) {
    const ref = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<ArrayBuffer>();

    const handleChangeImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();

        const { files } = e.target;
        if (files) {
            const file = files[0];
            props.onChangeImage?.(file);

            const reader = new FileReader();

            reader.onload = (e) =>
                setPreview(e.target?.result as ArrayBuffer);

            reader.readAsDataURL(file);
        }
    };

    return (
        <div
            className={styles.layout}
            style={{ backgroundImage: preview ? `url(${preview})` : undefined }}
            onDragOver={(e) => e.preventDefault()}>
            {!props.disabledImage && (
                <input
                    ref={ref}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleChangeImage}
                />
            )}
            <div>
                {!props.disabledImage && (
                    <button onClick={() => ref.current?.click()}>
                        <i className="far fa-image" /> 표지 이미지
                    </button>
                )}
                <input
                    name="title"
                    placeholder="포스트 제목"
                    maxLength={50}
                    value={props.value}
                    onChange={(e) => props.onChange(e.target.value)}
                />
            </div>
        </div>
    );
}
