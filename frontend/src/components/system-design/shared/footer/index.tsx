import styles from './Footer.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

export interface FooterProps {
    isDark?: boolean;
    children?: JSX.Element;
};

export function Footer({
    isDark = false,
    children,
}: FooterProps) {
    return (
        <footer className={cn('footer', { isDark })}>
            {children && (
                <div className={cn('content')}>
                    {children}
                </div>
            )}
            <div className={cn('items')}>
                <div>
                    <a target="_blank" href="https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca">
                        Notion
                    </a>
                </div>
                <div>
                    <a target="_blank" href="https://discord.gg/d4vCnB3CSr">
                        Discord
                    </a>
                </div>
                <div>
                    <a target="_blank" href="https://github.com/baealex/BLEX">
                        GitHub
                    </a>
                </div>
                <div>
                    <a href="mailto:im@baejino.com">
                        Contact
                    </a>
                </div>
            </div>
        </footer>
    );
}