import { useState } from 'react';

import {
    Modal,
} from '@components/integrated';

import { ImageForm } from '../forms';

interface Props {
    isOpen: boolean;
    close: Function;
    onUpload: Function;
}

let image: File | undefined;

export function ImageModal(props: Props) {
    const [ imagePath, setImagePath ] = useState('');
    const [ imagePreview, setImagePreview ] = useState('');

    return (
        <Modal
            title="이미지 업로드"
            isOpen={props.isOpen}
            onClose={() => props.close()}
            submitText="이미지를 추가합니다"
            onSubmit={() => {
                props.onUpload(image);
                props.close();

                setImagePath('');
                setImagePreview('');
                image = undefined;
            }}
        >
            <ImageForm
                title="이미지 선택"
                name="image"
                imageName={imagePath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const { files } = e.target;

                    if(files) {
                        image = files[0];

                        const reader = new FileReader();

                        reader.onload = (e) => {
                            setImagePreview(e.target?.result as string);
                        }

                        setImagePath(image.name);
                        reader.readAsDataURL(image);
                    }
                }}
            />
            <img src={imagePreview} className="w-100"/>
        </Modal>
    );
}