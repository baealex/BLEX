import styles from './Comment.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import {
    useRef,
    useState,
} from 'react';

import { toast } from 'react-toastify';

import { Card } from '@components/atoms';

import { dropImage } from '@modules/image';

interface Props {
    content: string;
    onChange: (content: string) => void;
    onSubmit: (content: string) => void;
};

export default function CommentForm(props: Props) {
    const input = useRef<HTMLTextAreaElement>(null);

    const [isOpen, setIsOpen] = useState(false);

    const onDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
        const cursorPos = input.current?.selectionStart;
        const textBefore = props.content.substring(0,  cursorPos);
        const textAfter  = props.content.substring(cursorPos || 0, props.content.length);

        const files = e.dataTransfer.files;
        if(files.length > 0) {
            const link = await dropImage(e);
            if(link) {
                const image = link.includes('.mp4') ? `@gif[${link}]` : `![](${link})`;
                props.onChange(textBefore + `${image}` + textAfter);
                return;
            }
        }

        e.preventDefault();
        const data = e.dataTransfer.getData('text/plain');
        if(data.includes('/@')) {
            const username = data.split('/@').pop();
            props.onChange(textBefore + `\`@${username}\`` + textAfter);
            return;
        }
    }

    const handleSubmit = () => {
        if(props.content == '') {
            toast('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        props.onSubmit(props.content);
        props.onChange('');
        setIsOpen(false);
    }

    return (
        <>
            <div
                className={cn(
                    'form',
                    { isOpen }
                )}
                onClick={() => {
                    !isOpen && setIsOpen(true);
                    input.current?.focus();
                }}
            >
                <Card
                    isRounded
                    className={`p-3 mb-3 noto ${cn(
                        'card',
                        { isOpen }
                    )}`}
                >
                    <>
                        <textarea
                            ref={input}
                            rows={5}
                            className={`noto ${cn({ isOpen })}`}
                            onChange={(e) => props.onChange(e.target.value)}
                            onDrop={(e) => onDrop(e)}
                            placeholder="배려와 매너가 밝은 커뮤니티를 만듭니다."
                            maxLength={300}
                            value={props.content}>
                        </textarea>
                        <div
                            className={cn('submit', { isOpen })}
                            onClick={() => {
                                isOpen && handleSubmit()
                            }}
                        >
                            <i className="fas fa-pencil-alt"/> 댓글 작성
                        </div>
                    </>
                </Card>
            </div>
        </>
    )
}