import styles from './EditorTitle.module.scss';

import React, {
    useRef,
    useState,
} from 'react';

export interface EditorTitleProps {
    value: string;
    onChange: (value: string) => void;
    onChangeImage: (image: File) => void;
}

export function EditorTitle(props: EditorTitleProps) {
    const ref = useRef<HTMLInputElement>(null);
    const [ preview, setPreview ] = useState<ArrayBuffer>();

    const handleChangeImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        
        const { files } = e.target;
        if (files) {
            const file = files[0];
            props.onChangeImage(file);

            const reader = new FileReader();

            reader.onload = (e) => 
                setPreview(e.target?.result as ArrayBuffer);

            reader.readAsDataURL(file);
        }
    };

    return (
        <>
            <input
                ref={ref}
                type="file"
                accept="image/*"
                style={{
                    display: 'none'
                }}
                onChange={handleChangeImage}
            />
            <div
                className={styles.layout}
                style={{
                    backgroundImage: preview ? `url(${preview})` : '',
                }}
                onDragOver={(e) => e.preventDefault()}
            >
                <div>
                    <button onClick={() => ref.current?.click()}>
                        <i className="far fa-image"/> 표지 이미지
                    </button>
                    <input
                        name="title"
                        placeholder="제목을 입력하세요."
                        maxLength={50}
                        value={props.value}
                        onChange={(e) => props.onChange(e.target.value)}
                    />
                </div>
            </div>
        </>
    );
}