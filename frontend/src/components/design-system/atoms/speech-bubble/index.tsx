import classNames from 'classnames/bind';
import styles from './SpeechBubble.module.scss';
const cn = classNames.bind(styles);

import Link from 'next/link';

interface SpeechBubbleProps {
    src: string;
    alt: string;
    href: string;
    className?: string;
    children: React.ReactNode;
}

export function SpeechBubble({
    alt,
    src,
    href,
    className,
    children,
}: SpeechBubbleProps) {
    return (
        <>
            <div className={classNames(cn('bubble'), className)}>
                <blockquote>
                    {children}
                </blockquote>
                <div className={cn('user')}>
                    <Link href={href}>
                        <a>
                            <img alt={alt} src={src}/>
                        </a>
                    </Link>
                </div>
            </div>
        </>
    );
}