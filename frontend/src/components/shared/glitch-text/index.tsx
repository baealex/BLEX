import styles from './GlitchText.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import { useEffect, useState } from 'react';

export interface GlitchTextProps {
    letters: string[];
}

export function GlitchText(props: GlitchTextProps) {
    const [ text, setText ] = useState('PAGE');

    useEffect(() => {
        const letters = props.letters;

        const skip = 4;
        let counter = 0;

        const swap = function() {
            if (counter++ == skip) {
                const randWord = 
                    letters[Math.floor(Math.random()*letters.length)]
                    + letters[Math.floor(Math.random()*letters.length)]
                    + letters[Math.floor(Math.random()*letters.length)]
                    + letters[Math.floor(Math.random()*letters.length)];
                setText(randWord);
                counter = 0;
            }

            window.requestAnimationFrame(swap);
        }

        swap();
    }, []);

    return (
        <>
            <div className={(cn('header'))} data-text={text}>
                {text}
            </div>
        </>
    )
}