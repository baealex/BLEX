import { Pencil } from '@baejino/icon';
import { useEffect, useState } from 'react';

import { Button, Card, Flex } from '~/components/design-system';
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
                <div className="mb-3" style={{ width: '100%' }}>
                    <EditorContent value={props.content} onChange={(value) => props.onChange(value)} />
                    <Button display="block" space="spare" type="button" onClick={handleSubmit}>
                        <Flex align="center" gap={2}>
                            <Pencil width={20} height={20} />
                            댓글 작성
                        </Flex>
                    </Button>
                </div>
            ) : (
                <Card
                    isRounded
                    hasShadow
                    hasBackground
                    className={'p-3 mb-3'}>
                    <div className="submit c-pointer" onClick={() => setIsOpen(true)}>
                        <Flex align="center" gap={2}>
                            <Pencil width={20} height={20} />
                            댓글 작성
                        </Flex>
                    </div>
                </Card>
            )}
        </>
    );
}
