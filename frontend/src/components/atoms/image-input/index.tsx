import { useRef, ChangeEvent } from 'react';

export interface ImageInputProps {
    url: string;
    label?: string;
    onChange?: (file: File) => void;
}

export function ImageInput(props: ImageInputProps) {
    const input = useRef<HTMLInputElement>(null);

    const onClickButton = () => {
        input.current?.click();
    }

    const onChangeImage = (e: ChangeEvent<HTMLInputElement>) => {
        const { files } = e.target;

        if(files) {
            if(props.onChange) {
                const image = files[0];
                props.onChange(image);
            }
        }
    }

    return (
        <>
            <input
                ref={input}
                type="file"
                style={{display: 'none'}}
                accept="image/*"
                onChange={(e) => onChangeImage(e)}
            />
            <div className="mb-1">
                <img
                    width="150px"
                    src={props.url}
                />
            </div>
            <button
                className="btn btn-dark"
                onClick={() => onClickButton()}
            >
                {props.label || '이미지 선택'}
            </button>
        </>
    )
}