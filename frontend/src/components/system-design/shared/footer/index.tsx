import classNames from 'classnames/bind';
import styles from './Footer.module.scss';
const cn = classNames.bind(styles);

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
            <ul className={cn('items')}>
                <li>
                    <a target="_blank" href="https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca">
                        Notion
                    </a>
                </li>
                <li>
                    <a target="_blank" href="https://discord.gg/d4vCnB3CSr">
                        Discord
                    </a>
                </li>
                <li>
                    <a target="_blank" href="https://github.com/baealex/BLEX">
                        GitHub
                    </a>
                </li>
                <li>
                    <a href="mailto:im@baejino.com">
                        Contact
                    </a>
                </li>
            </ul>
        </footer>
    );
}
