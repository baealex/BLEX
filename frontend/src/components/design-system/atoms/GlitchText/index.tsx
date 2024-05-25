import classNames from 'classnames/bind';
import styles from './GlitchText.module.scss';
const cx = classNames.bind(styles);

import {
    useEffect,
    useState
} from 'react';

export interface GlitchTextProps {
    letters: string[];
}

export function GlitchText(props: GlitchTextProps) {
    const [text, setText] = useState('PAGE');

    useEffect(() => {
        const letters = props.letters;
        const pick = () => {
            return Math.floor(Math.random() * letters.length);
        };

        (function swap() {
            setText(
                letters[pick()] +
                letters[pick()] +
                letters[pick()] +
                letters[pick()]
            );
            setTimeout(swap, 100);
        })();
    }, []);

    return (
        <div className={cx('header')} data-text={text}>
            {text}
        </div>
    );
}
