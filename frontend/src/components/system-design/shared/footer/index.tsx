import classNames from 'classnames/bind';
import styles from './Footer.module.scss';
const cn = classNames.bind(styles);

import { Carousel } from '@design-system';

export interface FooterProps {
    isDark?: boolean;
    children?: JSX.Element;
}

export function Footer({
    isDark = false,
    children
}: FooterProps) {
    return (
        <footer
            className={cn('footer', { isDark })}>
            {children && (
                <div className={cn('content')}>
                    {children}
                </div>
            )}
            <div className={cn('items')}>
                <Carousel
                    items={[
                        <a target="_blank" href="https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca">
                            블렉스는 어떤 서비스 인가요? 🤔
                        </a>,
                        <a target="_blank" href="https://github.com/baealex/BLEX">
                            블렉스는 코드가 공개된 서비스에요. 👍
                        </a>,
                        <a target="_blank" href="https://discord.gg/d4vCnB3CSr">
                            디스코드에서 함께 이야기해요. 💜
                        </a>
                    ]}
                />
            </div>
        </footer>
    );
}
