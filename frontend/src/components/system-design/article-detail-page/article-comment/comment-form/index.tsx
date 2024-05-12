import classNames from 'classnames/bind';
import styles from './CommentForm.module.scss';
const cn = classNames.bind(styles);

import { useEffect, useState } from 'react';

import { Button, Card } from '~/components/design-system';
import { EditorContent } from '~/components/system-design/article-editor-page';

import { snackBar } from '~/modules/ui/snack-bar';

export interface CommentFormProps {
    author: string;
    url: string;
    content: string;
    onChange: (content: string) => void;
    onSubmit: (content: string) => void;
}

export function CommentForm(props: CommentFormProps) {
    const [isOpen, setIsOpen] = useState(false);

    const handleSubmit = () => {
        if (props.content == '') {
            snackBar('😅 댓글의 내용을 입력해주세요.');
            return;
        }
        props.onSubmit(props.content);
        props.onChange('');
        setIsOpen(false);
    };

    useEffect(() => {
        setIsOpen(false);
    }, [props.author, props.url]);

    return (
        <>

            {isOpen ? (
                <div className="mb-3">
                    <EditorContent value={props.content} onChange={(value) => props.onChange(value)} />
                    <Button display="block" type="button" onClick={handleSubmit}>
                        <i className="fas fa-pencil-alt mr-2" />
                        댓글 작성
                    </Button>
                </div>
            ) : (
                <div
                    className={cn(
                        'form',
                        { isOpen }
                    )}
                    onClick={() => setIsOpen(true)}>
                    <Card
                        isRounded
                        hasShadow
                        hasBackground
                        backgroundType="background"
                        className={`p-3 mb-3 ${cn(
                            'card',
                            { isOpen }
                        )}`}>
                        <div className={cn('submit', { isOpen })}>
                            <i className="fas fa-pencil-alt" /> 댓글 작성
                        </div>
                    </Card>
                </div>
            )}
        </>
    );
}
