import styles from './CommentForm.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import {
    useEffect,
    useRef,
    useState,
} from 'react';

import { snackBar } from '@modules/ui/snack-bar';

import { Card } from '@design-system';

import { dropImage } from '@modules/utility/image';

export interface CommentFormProps {
    content: string;
    onChange: (content: string) => void;
    onSubmit: (content: string) => void;
};

export function CommentForm(props: CommentFormProps) {
    const box = useRef<HTMLDivElement>(null);
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
            snackBar('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        props.onSubmit(props.content);
        props.onChange('');
        setIsOpen(false);
    }

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const path = e.composedPath && e.composedPath();

            if (!path.includes(box.current as EventTarget)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('click', handleClick);
        return () => {
            document.removeEventListener('click', handleClick);
        }
    }, []);

    return (
        <>
            <div
                ref={box}
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
                    className={`p-3 mb-3 ${cn(
                        'card',
                        { isOpen }
                    )}`}
                >
                    <>
                        <textarea
                            ref={input}
                            rows={5}
                            className={cn({ isOpen })}
                            onChange={(e) => props.onChange(e.target.value)}
                            onDragOver={(e) => e.preventDefault()}
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