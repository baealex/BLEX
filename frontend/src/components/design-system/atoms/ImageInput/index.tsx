import classNames from 'classnames/bind';
import styles from './ImageInput.module.scss';
const cx = classNames.bind(styles);

import type { ChangeEvent } from 'react';
import { useRef } from 'react';

export interface ImageInputProps {
    url: string;
    label?: string;
    onChange?: (file: File) => void;
}

export function ImageInput(props: ImageInputProps) {
    const input = useRef<HTMLInputElement>(null);

    const onClickButton = () => {
        input.current?.click();
    };

    const onChangeImage = (e: ChangeEvent<HTMLInputElement>) => {
        const { files } = e.target;

        if (files) {
            if (props.onChange) {
                const image = files[0];
                props.onChange(image);
            }
        }
    };

    return (
        <div
            onClick={onClickButton}
            className={cx('image')}>
            <input
                ref={input}
                type="file"
                style={{ display: 'none' }}
                accept="image/*"
                onChange={(e) => onChangeImage(e)}
            />
            <img src={props.url}/>
            <div className={cx('cover')}>
                {props.label}
            </div>
        </div>
    );
}
