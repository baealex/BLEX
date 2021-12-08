import styles from './SpeechBubble.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import Link from 'next/link';

interface SpeechBubbleProps {
    userImage: string;
    username: string;
    children: any;
};

export function SpeechBubble({
    userImage,
    username,
    children,
}: SpeechBubbleProps) {
    return (
        <>
            <div className={classNames(cn('bubble'), 'mb-3')}>
                <blockquote>
                    {children}
                </blockquote>
                <div className={cn('user')}>
                    <Link href="/[author]" as={`/@${username}`}>
                        <a>
                            <img
                                alt={username}
                                src={userImage}
                            />
                        </a>
                    </Link>
                </div>
            </div>
        </>
    )
}