import { useEffect } from 'react';

import blexer from '@modules/blexer';
import ArticleContent from '@components/article/ArticleContent';
import {
    lazyLoadResource
} from '@modules/lazy';

interface Props {
    text: string;
    isEdit: boolean;
    onChange: Function;
}

export default function Block(props: Props) {
    let inputElement: HTMLTextAreaElement | null;

    useEffect(() => {
        if(inputElement) {
            inputElement.style.height = inputElement.scrollHeight + 'px';
        }
        if(!props.isEdit) {
            lazyLoadResource();
        }
    });

    return (
        <>
            {props.isEdit ? (
                <>
                    <textarea
                        ref={el => inputElement = el}
                        value={props.text} placeholder="마크다운으로 글을 작성하세요."
                        onChange={(e) => props.onChange(e)}
                    />
                    <style jsx>{`
                        textarea {
                            width: 100%;
                            height: auto;
                            border: none;
                            font-size: 1.028em;
                            line-height: 2;
                            background: none;
                            display: block;
                            overflow: hidden;
                            resize: none;

                            &:focus {
                                outline: none;    
                            }

                            @media (prefers-color-scheme: dark) {
                                color: #ccc;
                            }
                        }
                    `}</style>
                </>
            ) : (
                <>
                    <ArticleContent html={blexer(props.text)}/>
                </>
            )}
        </>
    );
}