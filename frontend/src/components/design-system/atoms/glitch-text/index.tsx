import classNames from 'classnames/bind';
import styles from './GlitchText.module.scss';
const cn = classNames.bind(styles);

import {
    useEffect,
    useState,
} from 'react';

export interface GlitchTextProps {
    letters: string[];
}

export function GlitchText(props: GlitchTextProps) {
    const [ text, setText ] = useState('PAGE');

    useEffect(() => {
        const letters = props.letters;

        const swap = function() {
            const randWord = 
                letters[Math.floor(Math.random()*letters.length)]
                + letters[Math.floor(Math.random()*letters.length)]
                + letters[Math.floor(Math.random()*letters.length)]
                + letters[Math.floor(Math.random()*letters.length)];
            setText(randWord);

            window.requestAnimationFrame(() => {
                setTimeout(swap, 100);
            });
        };

        swap();
    }, []);

    return (
        <>
            <div className={(cn('header'))} data-text={text}>
                {text}
            </div>
        </>
    );
}